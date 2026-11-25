import mongoose from "mongoose";
import productModel from "../models/products.model.js";
import salesOrderModel from "../models/sales-orders.model.js";
import stockTransactionModel from "../models/stock-transactions.model.js";
import supplierProfileModel from "../models/supplier-profiles.model.js";
import supplyRequestModel from "../models/supply-requests.model.js";
import warehouseInventoryModel from "../models/warehouse-inventory.model.js";
import warehouseModel from "../models/warehouses.model.js";
import uploadFile from "../../services/storage.service.js";
import { httpError, inTransaction } from "../utils/http-error.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

function normalizeSku(value) {
    return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "-") : "";
}

function readNonNegativeInteger(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function managerHasWarehouse(user, warehouseId) {
    return (user.assignedWarehouses || []).some((id) => id.toString() === warehouseId.toString());
}

async function validateSupplier(supplierId) {
    if (!supplierId) return null;
    if (!isValidId(supplierId)) throw httpError(400, "Choose a valid supplier.");
    const profile = await supplierProfileModel.findOne({ user: supplierId }).select("_id");
    if (!profile) throw httpError(400, "Complete the supplier profile before associating products.");
    return supplierId;
}

export async function createProduct(req, res) {
    if (!req.file) return res.status(400).json({ message: "A product image is required." });

    const name = req.body.name?.trim();
    const desc = req.body.desc?.trim();
    const sku = normalizeSku(req.body.sku);
    const category = req.body.category?.trim() || "General";
    const warehouseId = req.body.warehouseId;
    const supplierId = req.body.supplierId || null;
    const quantity = readNonNegativeInteger(req.body.quantity);
    const reorderLevel = readNonNegativeInteger(req.body.reorderLevel);
    const unitPrice = Number(req.body.unitPrice || 0);
    const binLocation = req.body.binLocation?.trim() || "";

    if (!name || name.length > 120 || !desc || desc.length > 1000) {
        return res.status(400).json({ message: "Enter a product name and description within the allowed lengths." });
    }
    if (!sku || !/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(sku)) {
        return res.status(400).json({ message: "SKU must be 2–40 characters, start with a letter or number, and contain only letters, numbers, hyphens, or underscores. Spaces are converted to hyphens." });
    }
    if (!category || category.length > 60 || binLocation.length > 100) {
        return res.status(400).json({ message: "Check the category and bin location." });
    }
    if (quantity === null || reorderLevel === null || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ message: "Quantity and reorder level must be whole numbers; price cannot be negative." });
    }
    if (!isValidId(warehouseId)) return res.status(400).json({ message: "Choose a valid warehouse." });
    if (req.user.role === "warehouse_manager" && !managerHasWarehouse(req.user, warehouseId)) {
        return res.status(403).json({ message: "You are not assigned to this warehouse." });
    }
    if (!await warehouseModel.exists({ _id: warehouseId, isActive: true })) {
        return res.status(404).json({ message: "Warehouse not found." });
    }
    if (await productModel.exists({ sku })) return res.status(409).json({ message: "That SKU is already in use." });
    const supplier = await validateSupplier(supplierId);
    if (!process.env.IMAGEKIT_PRIVATE_KEY) {
        return res.status(503).json({ message: "Product image uploads are not configured. Set IMAGEKIT_PRIVATE_KEY." });
    }

    const image = await uploadFile(req.file.buffer, req.file.originalname, "warehouse-products");
    try {
        const result = await inTransaction(async (session) => {
            const [product] = await productModel.create([{
                image: image.url,
                sku,
                name,
                desc,
                category,
                unitPrice,
                supplier,
                quantity,
                reorderLevel,
                location: binLocation,
                admin: req.user.role === "admin" ? req.user.id : null,
                createdBy: req.user.id
            }], { session });
            const [inventory] = await warehouseInventoryModel.create([{
                product: product._id,
                warehouse: warehouseId,
                quantity,
                reorderLevel,
                binLocation
            }], { session });
            if (quantity > 0) {
                await stockTransactionModel.create([{
                    product: product._id,
                    warehouse: warehouseId,
                    performedBy: req.user.id,
                    type: "receipt",
                    quantity,
                    beforeQuantity: 0,
                    afterQuantity: quantity,
                    note: "Opening stock"
                }], { session });
            }
            return { product, inventory };
        });
        return res.status(201).json({ message: "Product added to inventory.", ...result });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.sku) {
            return res.status(409).json({ message: "That SKU is already in use." });
        }
        throw error;
    }
}

export async function getProducts(req, res) {
    const filter = req.user.role === "supplier" ? { supplier: req.user.id } : {};
    const products = await productModel.find(filter)
        .populate("supplier", "username email")
        .sort({ updatedAt: -1, name: 1 })
        .lean();
    return res.status(200).json({ products });
}

export async function updateProduct(req, res) {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid product." });
    const product = await productModel.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });
    if (req.user.role === "warehouse_manager") {
        const assignedInventory = await warehouseInventoryModel.exists({
            product: product._id,
            warehouse: { $in: req.user.assignedWarehouses || [] }
        });
        if (!assignedInventory) return res.status(403).json({ message: "You cannot update products outside your assigned warehouses." });
    }

    const updates = {};
    for (const field of ["name", "desc", "category"]) {
        if (req.body[field] !== undefined) updates[field] = req.body[field].trim();
    }
    if (req.body.sku !== undefined) {
        const sku = normalizeSku(req.body.sku);
        if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(sku)) return res.status(400).json({ message: "SKU must be 2–40 characters, start with a letter or number, and contain only letters, numbers, hyphens, or underscores. Spaces are converted to hyphens." });
        updates.sku = sku;
    }
    if (req.body.unitPrice !== undefined) {
        const unitPrice = Number(req.body.unitPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ message: "Unit price must be zero or more." });
        updates.unitPrice = unitPrice;
    }
    if (req.body.supplierId !== undefined) updates.supplier = req.body.supplierId === "" ? null : await validateSupplier(req.body.supplierId);
    if (req.file) {
        if (!process.env.IMAGEKIT_PRIVATE_KEY) return res.status(503).json({ message: "Product image uploads are not configured. Set IMAGEKIT_PRIVATE_KEY." });
        const image = await uploadFile(req.file.buffer, req.file.originalname, "warehouse-products");
        updates.image = image.url;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: "No product changes were provided." });

    try {
        const updatedProduct = await productModel.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate("supplier", "username email");
        return res.status(200).json({ message: "Product updated.", product: updatedProduct });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.sku) return res.status(409).json({ message: "That SKU is already in use." });
        throw error;
    }
}

export async function deleteProduct(req, res) {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid product." });
    const product = await productModel.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found." });

    const [stock, transactions, orders, requests] = await Promise.all([
        warehouseInventoryModel.exists({ product: product._id, quantity: { $gt: 0 } }),
        stockTransactionModel.exists({ product: product._id }),
        salesOrderModel.exists({ "items.product": product._id }),
        supplyRequestModel.exists({ "items.product": product._id })
    ]);
    if (stock || transactions || orders || requests) {
        return res.status(409).json({ message: "This product has stock or warehouse history and cannot be deleted." });
    }

    await Promise.all([
        warehouseInventoryModel.deleteMany({ product: product._id }),
        productModel.deleteOne({ _id: product._id })
    ]);
    return res.status(200).json({ message: "Product deleted." });
}
