import mongoose from "mongoose";
import productModel from "../models/products.model.js";
import salesOrderModel from "../models/sales-orders.model.js";
import stockTransactionModel from "../models/stock-transactions.model.js";
import warehouseInventoryModel from "../models/warehouse-inventory.model.js";
import warehouseModel from "../models/warehouses.model.js";
import { httpError, inTransaction } from "../utils/http-error.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

function parseItems(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) return null;
    const seen = new Set();
    const parsed = [];
    for (const item of items) {
        const productId = item.productId;
        const quantity = Number(item.quantity);
        if (!isValidId(productId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000 || seen.has(String(productId))) {
            return null;
        }
        seen.add(String(productId));
        parsed.push({ product: productId, quantity });
    }
    return parsed;
}

function accessibleOrderFilter(user) {
    if (user.role === "sales_rep") return { salesRep: user.id };
    if (user.role === "warehouse_manager") return { warehouse: { $in: user.assignedWarehouses || [] } };
    return {};
}

async function populateOrder(order) {
    await order.populate([
        { path: "salesRep", select: "username email" },
        { path: "warehouse", select: "name code" },
        { path: "items.product", select: "sku name image unitPrice" },
        { path: "processedBy", select: "username" }
    ]);
    return order;
}

export async function listOrders(req, res) {
    const filter = accessibleOrderFilter(req.user);
    if (req.query.status && ["pending", "processing", "fulfilled", "cancelled"].includes(req.query.status)) {
        filter.status = req.query.status;
    }
    const orders = await salesOrderModel.find(filter)
        .populate("salesRep", "username email")
        .populate("warehouse", "name code")
        .populate("items.product", "sku name image unitPrice")
        .populate("processedBy", "username")
        .sort({ createdAt: -1 })
        .lean();
    return res.status(200).json({ orders });
}

export async function createOrder(req, res) {
    const warehouseId = req.body.warehouseId;
    const items = parseItems(req.body.items);
    if (!isValidId(warehouseId)) return res.status(400).json({ message: "Choose a valid warehouse." });
    if (!items) return res.status(400).json({ message: "Add 1–50 products with unique product IDs and positive whole-number quantities." });
    const warehouse = await warehouseModel.findOne({ _id: warehouseId, isActive: true }).select("_id");
    if (!warehouse) return res.status(404).json({ message: "Warehouse not found." });

    const productIds = items.map((item) => item.product);
    const products = await productModel.find({ _id: { $in: productIds } }).select("unitPrice").lean();
    if (products.length !== items.length) return res.status(400).json({ message: "One or more selected products are unavailable." });
    const productById = new Map(products.map((product) => [product._id.toString(), product]));

    const orderItems = [];
    for (const item of items) {
        const product = productById.get(item.product.toString());
        const inventory = await warehouseInventoryModel.findOne({ warehouse: warehouseId, product: item.product }).select("quantity").lean();
        if (!inventory || inventory.quantity < item.quantity) {
            return res.status(409).json({ message: "The selected warehouse does not have enough stock for this order." });
        }
        orderItems.push({ ...item, unitPrice: product.unitPrice || 0 });
    }
    const rawTotal = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    if (!Number.isFinite(rawTotal) || rawTotal > Number.MAX_SAFE_INTEGER) {
        return res.status(400).json({ message: "The order total exceeds the supported amount." });
    }
    const total = Math.round(rawTotal * 100) / 100;
    const [order] = await salesOrderModel.create([{
        salesRep: req.user.id,
        warehouse: warehouseId,
        items: orderItems,
        total
    }]);
    await populateOrder(order);
    return res.status(201).json({ message: "Sales order created.", order });
}

export async function cancelOrder(req, res) {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid sales order." });
    const order = await salesOrderModel.findOneAndUpdate(
        { _id: req.params.id, salesRep: req.user.id, status: "pending" },
        { $set: { status: "cancelled" } },
        { new: true, runValidators: true }
    );
    if (!order) return res.status(409).json({ message: "Only your unprocessed pending orders can be cancelled." });
    await populateOrder(order);
    return res.status(200).json({ message: "Order cancelled.", order });
}

export async function updateOrderStatus(req, res) {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid sales order." });
    const { status } = req.body;
    if (!["processing", "fulfilled"].includes(status)) {
        return res.status(400).json({ message: "Choose processing or fulfilled." });
    }
    const existing = await salesOrderModel.findById(req.params.id).select("warehouse status");
    if (!existing) return res.status(404).json({ message: "Sales order not found." });
    if (req.user.role === "warehouse_manager" && !(req.user.assignedWarehouses || []).some((id) => id.toString() === existing.warehouse.toString())) {
        return res.status(403).json({ message: "You are not assigned to this order’s warehouse." });
    }
    if (status === "fulfilled" && existing.status !== "processing") {
        return res.status(409).json({ message: "An order must be processed before it can be fulfilled." });
    }
    if (status === "processing" && existing.status !== "pending") {
        return res.status(409).json({ message: "Only pending orders can be processed." });
    }

    if (status === "fulfilled") {
        const order = await salesOrderModel.findOneAndUpdate(
            { _id: req.params.id, status: "processing" },
            { $set: { status: "fulfilled" } },
            { new: true, runValidators: true }
        );
        if (!order) return res.status(409).json({ message: "Order status changed. Refresh and try again." });
        await populateOrder(order);
        return res.status(200).json({ message: "Order fulfilled.", order });
    }

    const order = await inTransaction(async (session) => {
        const pending = await salesOrderModel.findOne({ _id: req.params.id, status: "pending" }).session(session);
        if (!pending) throw httpError(409, "Only pending orders can be processed.");
        for (const item of pending.items) {
            const inventory = await warehouseInventoryModel.findOne({
                warehouse: pending.warehouse,
                product: item.product
            }).session(session);
            if (!inventory || inventory.quantity < item.quantity) {
                throw httpError(409, "There is not enough stock to process this order.");
            }
            const beforeQuantity = inventory.quantity;
            inventory.quantity -= item.quantity;
            await inventory.save({ session });
            await stockTransactionModel.create([{
                warehouse: pending.warehouse,
                product: item.product,
                performedBy: req.user.id,
                type: "order_fulfillment",
                quantity: item.quantity,
                beforeQuantity,
                afterQuantity: inventory.quantity,
                note: `Sales order ${pending._id}`,
                reference: pending._id
            }], { session });
        }
        pending.status = "processing";
        pending.processedBy = req.user.id;
        pending.processedAt = new Date();
        await pending.save({ session });
        return pending;
    });

    await populateOrder(order);
    return res.status(200).json({ message: "Order processed and stock deducted.", order });
}
