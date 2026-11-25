import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import productModel from "../models/products.model.js";
import salesOrderModel from "../models/sales-orders.model.js";
import stockTransactionModel from "../models/stock-transactions.model.js";
import supplyRequestModel from "../models/supply-requests.model.js";
import supplierProfileModel from "../models/supplier-profiles.model.js";
import userModel from "../models/users.model.js";
import warehouseInventoryModel from "../models/warehouse-inventory.model.js";
import warehouseModel from "../models/warehouses.model.js";

const roles = ["admin", "warehouse_manager", "supplier", "sales_rep"];

function validEmail(email) {
    return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function validateWarehouseIds(ids) {
    if (!Array.isArray(ids) || ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) return null;
    const uniqueIds = [...new Set(ids.map(String))];
    if (uniqueIds.length !== ids.length) return null;
    const count = await warehouseModel.countDocuments({ _id: { $in: uniqueIds } });
    return count === uniqueIds.length ? uniqueIds : null;
}

export async function getAdminStats(_req, res) {
    const [users, products, warehouses, suppliers, orders, lowStock] = await Promise.all([
        userModel.countDocuments({ role: { $in: roles } }),
        productModel.countDocuments(),
        warehouseModel.countDocuments(),
        supplierProfileModel.countDocuments(),
        salesOrderModel.countDocuments(),
        warehouseInventoryModel.aggregate([
            { $match: { $expr: { $lte: ["$quantity", "$reorderLevel"] } } },
            { $count: "count" }
        ])
    ]);

    return res.status(200).json({
        stats: { users, products, warehouses, suppliers, orders, lowStock: lowStock[0]?.count || 0 }
    });
}

export async function listUsers(_req, res) {
    const users = await userModel.find({ role: { $in: roles } })
        .select("_id username email role assignedWarehouses isActive createdAt")
        .populate("assignedWarehouses", "name code")
        .sort({ createdAt: -1 })
        .lean();
    return res.status(200).json({ users });
}

export async function createUser(req, res) {
    const username = req.body.username?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const role = req.body.role;
    if (!username || username.length < 2 || username.length > 80 || !validEmail(email)) {
        return res.status(400).json({ message: "Enter a valid user name and email address." });
    }
    if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "The initial password must be at least 8 characters." });
    }
    if (!roles.includes(role)) return res.status(400).json({ message: "Choose one of the four supported roles." });
    const assignedWarehouses = role === "warehouse_manager"
        ? await validateWarehouseIds(req.body.assignedWarehouseIds || [])
        : [];
    if (assignedWarehouses === null) return res.status(400).json({ message: "Choose valid, non-duplicate warehouse assignments." });

    try {
        const user = await userModel.create({
            username,
            email,
            password: await bcrypt.hash(password, 10),
            role,
            assignedWarehouses
        });
        return res.status(201).json({
            message: "User created.",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                assignedWarehouses: user.assignedWarehouses,
                isActive: user.isActive
            }
        });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "That username or email is already in use." });
        throw error;
    }
}

export async function updateUser(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid user." });
    const user = await userModel.findById(req.params.id);
    if (!user || !roles.includes(user.role)) return res.status(404).json({ message: "User not found." });

    const updates = {};
    if (req.body.username !== undefined) {
        const username = req.body.username.trim();
        if (username.length < 2 || username.length > 80) return res.status(400).json({ message: "User name must be between 2 and 80 characters." });
        updates.username = username;
    }
    if (req.body.email !== undefined) {
        const email = req.body.email.trim().toLowerCase();
        if (!validEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
        updates.email = email;
    }
    if (req.body.role !== undefined) {
        if (!roles.includes(req.body.role)) return res.status(400).json({ message: "Choose one of the four supported roles." });
        updates.role = req.body.role;
    }
    if (req.body.isActive !== undefined) {
        if (typeof req.body.isActive !== "boolean") return res.status(400).json({ message: "Choose an active or inactive state." });
        updates.isActive = req.body.isActive;
    }
    if (req.body.password !== undefined) {
        if (typeof req.body.password !== "string" || req.body.password.length < 8) {
            return res.status(400).json({ message: "A reset password must be at least 8 characters." });
        }
        updates.password = await bcrypt.hash(req.body.password, 10);
    }
    const resultingRole = updates.role || user.role;
    if (req.body.assignedWarehouseIds !== undefined || (updates.role && resultingRole !== "warehouse_manager")) {
        const assignedWarehouses = resultingRole === "warehouse_manager"
            ? await validateWarehouseIds(req.body.assignedWarehouseIds || [])
            : [];
        if (assignedWarehouses === null) return res.status(400).json({ message: "Choose valid, non-duplicate warehouse assignments." });
        updates.assignedWarehouses = assignedWarehouses;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: "No user changes were provided." });

    const removesLastAdmin = user.role === "admin"
        && (updates.role && updates.role !== "admin" || updates.isActive === false);
    if (removesLastAdmin) {
        const activeAdmins = await userModel.countDocuments({ role: "admin", isActive: true });
        if (activeAdmins <= 1) return res.status(409).json({ message: "At least one active administrator must remain." });
    }

    try {
        const updatedUser = await userModel.findByIdAndUpdate(
            user._id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select("_id username email role assignedWarehouses isActive createdAt").populate("assignedWarehouses", "name code");
        return res.status(200).json({ message: "User updated.", user: updatedUser });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "That username or email is already in use." });
        throw error;
    }
}

export async function deleteUser(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid user." });
    if (req.user.id === req.params.id) return res.status(409).json({ message: "You cannot delete your own active administrator account." });
    const user = await userModel.findById(req.params.id);
    if (!user || !roles.includes(user.role)) return res.status(404).json({ message: "User not found." });

    if (user.role === "admin" && user.isActive) {
        const activeAdmins = await userModel.countDocuments({ role: "admin", isActive: true });
        if (activeAdmins <= 1) return res.status(409).json({ message: "At least one active administrator must remain." });
    }
    const [orders, requests, transactions, products, managedWarehouses] = await Promise.all([
        salesOrderModel.exists({ salesRep: user._id }),
        supplyRequestModel.exists({ supplier: user._id }),
        stockTransactionModel.exists({ performedBy: user._id }),
        productModel.exists({ supplier: user._id }),
        user.role === "warehouse_manager" ? user.assignedWarehouses.length : false
    ]);
    if (orders || requests || transactions || products || managedWarehouses) {
        return res.status(409).json({ message: "This user has warehouse history or assignments. Deactivate the account to preserve records." });
    }

    await Promise.all([
        user.deleteOne(),
        supplierProfileModel.deleteOne({ user: user._id })
    ]);
    return res.status(200).json({ message: "User deleted." });
}

export async function listSuppliers(_req, res) {
    const suppliers = await supplierProfileModel.find()
        .populate("user", "username email isActive")
        .sort({ companyName: 1 })
        .lean();
    return res.status(200).json({ suppliers });
}

export async function getSupplierProducts(req, res) {
    const products = await productModel.find({ supplier: req.params.id })
        .select("sku name category image unitPrice")
        .sort({ name: 1 })
        .lean();
    return res.status(200).json({ products });
}
