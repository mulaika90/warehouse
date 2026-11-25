import express from "express";
import {
    bookAppointment,
    cancelAppointment,
    listDoctorAppointments,
    listMyAppointments,
    updateAppointmentStatus
} from "../controllers/clinic.controller.js";
import { authenticateToken, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticateToken);
router.post("/", authorizeRoles("patient"), bookAppointment);
router.get("/my", authorizeRoles("patient"), listMyAppointments);
router.get("/doctor", authorizeRoles("doctor"), listDoctorAppointments);
router.patch("/:id/status", authorizeRoles("doctor"), updateAppointmentStatus);
router.patch("/:id/cancel", authorizeRoles("patient"), cancelAppointment);

export default router;
