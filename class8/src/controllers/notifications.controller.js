import mongoose from "mongoose";
import notificationModel from "../models/notifications.model.js";

export async function listNotifications(req, res) {
    const recipient = req.user.id;
    const [notifications, unreadCount] = await Promise.all([
        notificationModel.find({ recipient })
            .select("_id type title message appointment readAt createdAt")
            .sort({ createdAt: -1 })
            .limit(30)
            .lean(),
        notificationModel.countDocuments({ recipient, readAt: null })
    ]);

    return res.status(200).json({ notifications, unreadCount });
}

export async function markAllNotificationsRead(req, res) {
    await notificationModel.updateMany(
        { recipient: req.user.id, readAt: null },
        { $set: { readAt: new Date() } }
    );
    return res.status(200).json({ message: "Notifications marked as read." });
}

export async function markNotificationRead(req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid notification." });
    }
    const notification = await notificationModel.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user.id, readAt: null },
        { $set: { readAt: new Date() } },
        { new: true }
    ).select("_id readAt");

    if (!notification) {
        return res.status(404).json({ message: "Notification not found." });
    }
    return res.status(200).json({ message: "Notification marked as read.", notification });
}
