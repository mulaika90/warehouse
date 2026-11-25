import express from "express";
import { cancelOrder, createOrder, listOrders, updateOrderStatus } from "../controllers/orders.controller.js";
import { authenticateToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(authenticateToken);

router.get("/", authorizeRoles("admin", "warehouse_manager", "sales_rep"), listOrders);
router.post("/", authorizeRoles("sales_rep"), createOrder);
router.patch("/:id/cancel", authorizeRoles("sales_rep"), cancelOrder);
router.patch("/:id/status", authorizeRoles("admin", "warehouse_manager"), updateOrderStatus);

export default router;
