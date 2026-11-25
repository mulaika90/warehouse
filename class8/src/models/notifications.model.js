import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ["appointment-request", "appointment-update", "appointment-cancelled", "new-patient"],
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 120
    },
    message: {
        type: String,
        required: true,
        maxlength: 300
    },
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "appointment",
        default: null
    },
    readAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });

const notificationModel = mongoose.model("notification", notificationSchema);
export default notificationModel;
