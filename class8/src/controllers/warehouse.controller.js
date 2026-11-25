import mongoose from "mongoose";
import productModel from "../models/products.model.js";
import salesOrderModel from "../models/sales-orders.model.js";
import stockTransactionModel from "../models/stock-transactions.model.js";
import supplyRequestModel from "../models/supply-requests.model.js";
import userModel from "../models/users.model.js";
import warehouseInventoryModel from "../models/warehouse-inventory.model.js";
import warehouseModel from "../models/warehouses.model.js";
import { httpError, inTransaction } from "../utils/http-error.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const isManager = (user) => user.role === "warehouse_manager";

function isAssigned(user, warehouseId) {
    return (user.assignedWarehouses || []).some((id) => id.toString() === warehouseId.toString());
}

async function findAccessibleWarehouse(id, user, { activeOnly = true } = {}) {
    if (!isValidId(id)) throw httpError(400, "Invalid warehouse.");
    if (isManager(user) && !isAssigned(user, id)) {
        throw httpError(403, "You are not assigned to this warehouse.");
    }
    const filter = { _id: id };
    if (activeOnly) filter.isActive = true;
    const warehouse = await warehouseModel.findOne(filter);
    if (!warehouse) throw httpError(404, "Warehouse not found.");
    return warehouse;
}

export async function listWarehouses(req, res) {
    const filter = {};
    if (req.query.includeInactive !== "true" || req.user.role !== "admin") filter.isActive = true;
    if (isManager(req.user)) {
        filter._id = { $in: req.user.assignedWarehouses || [] };
    }
    const warehouses = await warehouseModel.find(filter).sort({ name: 1 }).lean();
    return res.status(200).json({ warehouses });
}

export async function createWarehouse(req, res) {
    const name = req.body.name?.trim();
    const code = req.body.code?.trim().toUpperCase();
    const address = req.body.address?.trim() || "";
    if (!name || name.length > 100 || !/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code || "")) {
        return res.status(400).json({ message: "Enter a warehouse name and a valid 2–30 character code." });
    }
    if (address.length > 250) return res.status(400).json({ message: "Warehouse address is too long." });

    try {
        const warehouse = await warehouseModel.create({ name, code, address });
        return res.status(201).json({ message: "Warehouse created.", warehouse });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "That warehouse code is already in use." });
        throw error;
    }
}

export async function updateWarehouse(req, res) {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse." });
    const updates = {};
    if (req.body.name !== undefined) {
        const name = req.body.name.trim();
        if (!name || name.length > 100) return res.status(400).json({ message: "Enter a valid warehouse name." });
        updates.name = name;
    }
    if (req.body.code !== undefined) {
        const code = req.body.code.trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code)) return res.status(400).json({ message: "Enter a valid warehouse code." });
        updates.code = code;
    }
    if (req.body.address !== undefined) {
        const address = req.body.address.trim();
        if (address.length > 250) return res.status(400).json({ message: "Warehouse address is too long." });
        updates.address = address;
    }
    if (req.body.isActive !== undefined) {
        if (typeof req.body.isActive !== "boolean") return res.status(400).json({ message: "Choose an active or inactive state." });
        updates.isActive = req.body.isActive;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: "No warehouse changes were provided." });

    try {
        const warehouse = await warehouseModel.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
        if (!warehouse) return res.status(404).json({ message: "Warehouse not found." });
        return res.status(200).json({ message: "Warehouse updated.", warehouse });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "That warehouse code is already in use." });
        throw error;
    }
}

export async function deleteWarehouse(req, res) {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid warehouse." });
    const warehouse = await warehouseModel.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: "Warehouse not found." });

    const [inventory, transactions, orders, requests] = await Promise.all([
        warehouseInventoryModel.exists({ warehouse: warehouse._id }),
        stockTransactionModel.exists({ warehouse: warehouse._id }),
        salesOrderModel.exists({ warehouse: warehouse._id }),
        supplyRequestModel.exists({ warehouse: warehouse._id })
    ]);
    if (inventory || transactions || orders || requests) {
        return res.status(409).json({ message: "This warehouse has inventory or history. Deactivate it instead of deleting it." });
    }

    await Promise.all([
        warehouse.deleteOne(),
        userModel.updateMany({ assignedWarehouses: warehouse._id }, { $pull: { assignedWarehouses: warehouse._id } })
    ]);
    return res.status(200).json({ message: "Warehouse deleted." });
}

export async function listWarehouseInventory(req, res) {
    await findAccessibleWarehouse(req.params.warehouseId, req.user);
    const inventory = await warehouseInventoryModel.find({ warehouse: req.params.warehouseId })
        .populate("product", "sku name desc image category unitPrice supplier")
        .populate("warehouse", "name code")
        .sort({ updatedAt: -1 })
        .lean();
    return res.status(200).json({ inventory });
}

export async function listCatalogInventory(req, res) {
    const warehouseFilter = {};
    if (req.query.warehouseId) {
        await findAccessibleWarehouse(req.query.warehouseId, req.user);
        warehouseFilter.warehouse = req.query.warehouseId;
    } else if (isManager(req.user)) {
        warehouseFilter.warehouse = { $in: req.user.assignedWarehouses || [] };
    } else {
        const activeWarehouses = await warehouseModel.find({ isActive: true }).select("_id").lean();
        warehouseFilter.warehouse = { $in: activeWarehouses.map((warehouse) => warehouse._id) };
    }

    if (req.user.role === "supplier") {
        const products = await productModel.find({ supplier: req.user.id }).select("_id").lean();
        warehouseFilter.product = { $in: products.map((product) => product._id) };
    }

    const inventory = await warehouseInventoryModel.find(warehouseFilter)
        .populate("product", "sku name desc image category unitPrice supplier")
        .populate("warehouse", "name code")
        .sort({ updatedAt: -1 })
        .lean();
    return res.status(200).json({ inventory });
}

export async function listLowStock(req, res) {
    const filter = {};
    if (req.query.warehouseId) {
        await findAccessibleWarehouse(req.query.warehouseId, req.user);
        filter.warehouse = req.query.warehouseId;
    } else if (isManager(req.user)) {
        filter.warehouse = { $in: req.user.assignedWarehouses || [] };
    }

    const inventory = await warehouseInventoryModel.find(filter)
        .populate("product", "sku name image category")
        .populate("warehouse", "name code")
        .sort({ quantity: 1, updatedAt: -1 })
        .lean();
    return res.status(200).json({
        inventory: inventory.filter((item) => item.quantity <= item.reorderLevel)
    });
}

export async function listStockTransactions(req, res) {
    const filter = {};
    const warehouseId = req.params.warehouseId || req.query.warehouseId;
    if (warehouseId) {
        await findAccessibleWarehouse(warehouseId, req.user, { activeOnly: false });
        filter.warehouse = warehouseId;
    } else if (isManager(req.user)) {
        filter.warehouse = { $in: req.user.assignedWarehouses || [] };
    }
    if (req.query.type) filter.type = req.query.type;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
    const transactions = await stockTransactionModel.find(filter)
        .populate("product", "sku name image")
        .populate("warehouse", "name code")
        .populate("performedBy", "username email")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    return res.status(200).json({ transactions });
}

export async function createStockTransaction(req, res) {
    const { productId, type, note } = req.body;
    const quantity = Number(req.body.quantity);
    if (!isValidId(productId)) return res.status(400).json({ message: "Choose a valid product." });
    if (!["receipt", "stock_out"].includes(type)) return res.status(400).json({ message: "Choose a stock receipt or stock-out transaction." });
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
        return res.status(400).json({ message: "Quantity must be a whole number between 1 and 1,000,000." });
    }
    if (typeof note === "string" && note.length > 500) return res.status(400).json({ message: "Transaction note is too long." });
    await findAccessibleWarehouse(req.params.warehouseId, req.user);

    const result = await inTransaction(async (session) => {
        const inventory = await warehouseInventoryModel.findOne({
            warehouse: req.params.warehouseId,
            product: productId
        }).session(session);
        if (!inventory) throw httpError(404, "This product is not assigned to the selected warehouse.");

        const beforeQuantity = inventory.quantity;
        if (type === "stock_out" && quantity > beforeQuantity) {
            throw httpError(409, "There is not enough stock to complete this stock-out.");
        }
        inventory.quantity = type === "receipt" ? beforeQuantity + quantity : beforeQuantity - quantity;
        await inventory.save({ session });

        const [transaction] = await stockTransactionModel.create([{
            warehouse: inventory.warehouse,
            product: inventory.product,
            performedBy: req.user.id,
            type,
            quantity,
            beforeQuantity,
            afterQuantity: inventory.quantity,
            note: note?.trim() || ""
        }], { session });
        return { transaction, inventory };
    });

    await result.transaction.populate([
        { path: "product", select: "sku name image" },
        { path: "warehouse", select: "name code" },
        { path: "performedBy", select: "username email" }
    ]);
    return res.status(201).json({ message: "Stock transaction recorded.", transaction: result.transaction, inventory: result.inventory });
}
