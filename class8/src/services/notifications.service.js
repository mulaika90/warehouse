import notificationModel from "../models/notifications.model.js";
import userModel from "../models/users.model.js";

export async function notifyUsers(recipientIds, notification) {
    const recipients = [...new Set(recipientIds.filter(Boolean).map(String))];
    if (!recipients.length) return;

    await notificationModel.insertMany(recipients.map((recipient) => ({
        recipient,
        ...notification
    })));
}

export async function notifyAdmins(notification) {
    const admins = await userModel.find({ role: "admin", isActive: true }).select("_id").lean();
    await notifyUsers(admins.map((admin) => admin._id), notification);
}
