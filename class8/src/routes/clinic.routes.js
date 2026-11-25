import express from "express";
import {
    createDoctor,
    deleteUser,
    getAdminStats,
    listAllAppointments,
    listDoctors,
    listUsers,
    updateUserStatus
} from "../controllers/clinic.controller.js";
import { authenticateToken, requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/doctors", listDoctors);
router.get("/admin/stats", authenticateToken, requireAdmin, getAdminStats);
router.get("/admin/users", authenticateToken, requireAdmin, listUsers);
router.post("/admin/doctors", authenticateToken, requireAdmin, createDoctor);
router.patch("/admin/users/:id/status", authenticateToken, requireAdmin, updateUserStatus);
router.delete("/admin/users/:id", authenticateToken, requireAdmin, deleteUser);
router.get("/admin/appointments", authenticateToken, requireAdmin, listAllAppointments);

export default router;
