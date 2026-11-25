import express from "express";
import {
    createUser,
    deleteUser,
    getAdminStats,
    getSupplierProducts,
    listSuppliers,
    listUsers,
    updateUser
} from "../controllers/admin.controller.js";
import { listOrders, updateOrderStatus } from "../controllers/orders.controller.js";
import {
    listAllSupplyRequests,
    reviewSupplyRequest
} from "../controllers/supplier.controller.js";
import {
    createWarehouse,
    deleteWarehouse,
    listStockTransactions,
    listWarehouses,
    updateWarehouse
} from "../controllers/warehouse.controller.js";
import { authenticateToken, requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(authenticateToken, requireAdmin);

router.get("/stats", getAdminStats);
router.get("/users", listUsers);
router.post("/users", createUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.get("/warehouses", listWarehouses);
router.post("/warehouses", createWarehouse);
router.patch("/warehouses/:id", updateWarehouse);
router.delete("/warehouses/:id", deleteWarehouse);
router.get("/suppliers", listSuppliers);
router.get("/suppliers/:id/products", getSupplierProducts);
router.get("/transactions", listStockTransactions);
router.get("/orders", listOrders);
router.patch("/orders/:id/status", updateOrderStatus);
router.get("/supply-requests", listAllSupplyRequests);
router.patch("/supply-requests/:id/review", reviewSupplyRequest);

export default router;
