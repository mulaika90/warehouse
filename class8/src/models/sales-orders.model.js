import mongoose from "mongoose";

const salesOrderSchema = new mongoose.Schema({
    salesRep: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "warehouse", required: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 }
    }],
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "processing", "fulfilled", "cancelled"], default: "pending" },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    processedAt: { type: Date, default: null }
}, { timestamps: true });

salesOrderSchema.index({ salesRep: 1, createdAt: -1 });
salesOrderSchema.index({ warehouse: 1, status: 1, createdAt: -1 });

const salesOrderModel = mongoose.model("salesOrder", salesOrderSchema);
export default salesOrderModel;
