import mongoose from "mongoose";

const supplyRequestSchema = new mongoose.Schema({
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "warehouse", required: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
        quantity: { type: Number, required: true, min: 1 }
    }],
    note: { type: String, trim: true, maxlength: 500, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: "" },
    reviewedAt: { type: Date, default: null }
}, { timestamps: true });

supplyRequestSchema.index({ supplier: 1, createdAt: -1 });
supplyRequestSchema.index({ warehouse: 1, status: 1, createdAt: -1 });

const supplyRequestModel = mongoose.model("supplyRequest", supplyRequestSchema);
export default supplyRequestModel;
