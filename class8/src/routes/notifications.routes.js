import express from "express";
import {
    listNotifications,
    markAllNotificationsRead,
    markNotificationRead
} from "../controllers/notifications.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authenticateToken);
router.get("/", listNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export default router;
