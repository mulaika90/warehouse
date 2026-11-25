import express from "express";
import {
    createStockTransaction,
    createWarehouse,
    deleteWarehouse,
    listCatalogInventory,
    listLowStock,
    listStockTransactions,
    listWarehouseInventory,
    listWarehouses,
    updateWarehouse
} from "../controllers/warehouse.controller.js";
import { listAllSupplyRequests, reviewSupplyRequest } from "../controllers/supplier.controller.js";
import { authenticateToken, authorizeRoles, requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(authenticateToken);

router.get("/", authorizeRoles("admin", "warehouse_manager", "supplier", "sales_rep"), listWarehouses);
router.post("/", requireAdmin, createWarehouse);
router.get("/catalog", authorizeRoles("admin", "warehouse_manager", "supplier", "sales_rep"), listCatalogInventory);
router.get("/low-stock", authorizeRoles("admin", "warehouse_manager"), listLowStock);
router.get("/transactions", authorizeRoles("admin", "warehouse_manager"), listStockTransactions);
router.get("/supply-requests", authorizeRoles("admin", "warehouse_manager"), listAllSupplyRequests);
router.patch("/supply-requests/:id/review", authorizeRoles("admin", "warehouse_manager"), reviewSupplyRequest);
router.get("/:warehouseId/inventory", authorizeRoles("admin", "warehouse_manager"), listWarehouseInventory);
router.get("/:warehouseId/transactions", authorizeRoles("admin", "warehouse_manager"), listStockTransactions);
router.post("/:warehouseId/transactions", authorizeRoles("admin", "warehouse_manager"), createStockTransaction);
router.patch("/:id", requireAdmin, updateWarehouse);
router.delete("/:id", requireAdmin, deleteWarehouse);

export default router;
