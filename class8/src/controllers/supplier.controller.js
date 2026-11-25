import mongoose from "mongoose";
import productModel from "../models/products.model.js";
import supplierProfileModel from "../models/supplier-profiles.model.js";
import supplyRequestModel from "../models/supply-requests.model.js";
import warehouseInventoryModel from "../models/warehouse-inventory.model.js";
import warehouseModel from "../models/warehouses.model.js";
import stockTransactionModel from "../models/stock-transactions.model.js";
import uploadFile from "../../services/storage.service.js";
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

export async function getSupplierProfile(req, res) {
    const profile = await supplierProfileModel.findOne({ user: req.user.id })
        .populate("user", "username email")
        .lean();
    return res.status(200).json({ profile });
}

export async function updateSupplierProfile(req, res) {
    const companyName = req.body.companyName?.trim();
    const phone = req.body.phone?.trim() || "";
    const address = req.body.address?.trim() || "";
    if (!companyName || companyName.length > 120 || phone.length > 40 || address.length > 250) {
        return res.status(400).json({ message: "Enter a company name and valid contact details." });
    }

    const updates = { companyName, phone, address };
    if (req.file) {
        if (!process.env.IMAGEKIT_PRIVATE_KEY) {
            return res.status(503).json({ message: "Supplier image uploads are not configured. Set IMAGEKIT_PRIVATE_KEY." });
        }
        const image = await uploadFile(req.file.buffer, req.file.originalname, "supplier-logos");
        updates.logoUrl = image.url;
    }

    const profile = await supplierProfileModel.findOneAndUpdate(
        { user: req.user.id },
        { $set: updates, $setOnInsert: { user: req.user.id } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate("user", "username email");

    return res.status(200).json({ message: "Supplier profile saved.", profile });
}

export async function listSupplierProducts(req, res) {
    const products = await productModel.find({ supplier: req.user.id })
        .select("sku name desc image category unitPrice")
        .sort({ name: 1 })
        .lean();
    return res.status(200).json({ products });
}

export async function listSupplierCatalog(_req, res) {
    const products = await productModel.find()
        .select("sku name category unitPrice")
        .sort({ name: 1 })
        .lean();
    return res.status(200).json({ products });
}

export async function listSupplyRequests(req, res) {
    const requests = await supplyRequestModel.find({ supplier: req.user.id })
        .populate("warehouse", "name code")
        .populate("items.product", "sku name image")
        .populate("reviewedBy", "username")
        .sort({ createdAt: -1 })
        .lean();
    return res.status(200).json({ requests });
}

export async function createSupplyRequest(req, res) {
    const warehouseId = req.body.warehouseId;
    const items = parseItems(req.body.items);
    const note = req.body.note?.trim() || "";
    if (!isValidId(warehouseId)) return res.status(400).json({ message: "Choose a valid warehouse." });
    if (!items) return res.status(400).json({ message: "Add 1–50 products with unique product IDs and positive whole-number quantities." });
    if (note.length > 500) return res.status(400).json({ message: "Request note is too long." });

    const warehouse = await warehouseModel.findOne({ _id: warehouseId, isActive: true }).select("_id");
    if (!warehouse) return res.status(404).json({ message: "Warehouse not found." });
    const productIds = items.map((item) => item.product);
    const productCount = await productModel.countDocuments({ _id: { $in: productIds } });
    if (productCount !== items.length) return res.status(400).json({ message: "Supply requests can include only products in the catalog." });

    const request = await supplyRequestModel.create({
        supplier: req.user.id,
        warehouse: warehouseId,
        items,
        note
    });
    await request.populate([
        { path: "warehouse", select: "name code" },
        { path: "items.product", select: "sku name image" }
    ]);
    return res.status(201).json({ message: "Supply request submitted.", request });
}

export async function listAllSupplyRequests(req, res) {
    const filter = {};
    if (req.user.role === "warehouse_manager") {
        filter.warehouse = { $in: req.user.assignedWarehouses || [] };
    }
    if (req.query.status && ["pending", "approved", "rejected"].includes(req.query.status)) {
        filter.status = req.query.status;
    }
    const requests = await supplyRequestModel.find(filter)
        .populate("supplier", "username email")
        .populate("warehouse", "name code")
        .populate("items.product", "sku name image")
        .populate("reviewedBy", "username")
        .sort({ createdAt: -1 })
        .lean();
    return res.status(200).json({ requests });
}

export async function reviewSupplyRequest(req, res) {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid supply request." });
    const { status } = req.body;
    const reviewNote = req.body.reviewNote?.trim() || "";
    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Choose approved or rejected." });
    }
    if (reviewNote.length > 500) return res.status(400).json({ message: "Review note is too long." });

    const existing = await supplyRequestModel.findById(req.params.id).select("warehouse status");
    if (!existing) return res.status(404).json({ message: "Supply request not found." });
    if (req.user.role === "warehouse_manager" && !(req.user.assignedWarehouses || []).some((id) => id.toString() === existing.warehouse.toString())) {
        return res.status(403).json({ message: "You are not assigned to this warehouse." });
    }

    const request = await inTransaction(async (session) => {
        const pending = await supplyRequestModel.findOneAndUpdate(
            { _id: req.params.id, status: "pending" },
            { $set: { status, reviewNote, reviewedBy: req.user.id, reviewedAt: new Date() } },
            { new: true, session }
        );
        if (!pending) throw httpError(409, "This supply request has already been reviewed.");

        if (status === "approved") {
            for (const item of pending.items) {
                const product = await productModel.findById(item.product).select("reorderLevel location").session(session);
                if (!product) throw httpError(409, "A requested product is no longer available.");
                const inventory = await warehouseInventoryModel.findOne({
                    warehouse: pending.warehouse,
                    product: item.product
                }).session(session);
                const beforeQuantity = inventory?.quantity || 0;
                const afterQuantity = beforeQuantity + item.quantity;
                if (inventory) {
                    inventory.quantity = afterQuantity;
                    await inventory.save({ session });
                } else {
                    await warehouseInventoryModel.create([{
                        warehouse: pending.warehouse,
                        product: item.product,
                        quantity: afterQuantity,
                        reorderLevel: product.reorderLevel || 5,
                        binLocation: product.location || ""
                    }], { session });
                }
                await stockTransactionModel.create([{
                    warehouse: pending.warehouse,
                    product: item.product,
                    performedBy: req.user.id,
                    type: "supply_receipt",
                    quantity: item.quantity,
                    beforeQuantity,
                    afterQuantity,
                    note: reviewNote || "Approved supplier delivery",
                    reference: pending._id
                }], { session });
            }
        }
        return pending;
    });

    await request.populate([
        { path: "supplier", select: "username email" },
        { path: "warehouse", select: "name code" },
        { path: "items.product", select: "sku name image" },
        { path: "reviewedBy", select: "username" }
    ]);
    return res.status(200).json({ message: `Supply request ${status}.`, request });
}
