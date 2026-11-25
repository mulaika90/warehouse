import mongoose from "mongoose";

const stockTransactionSchema = new mongoose.Schema({
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "warehouse", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    type: {
        type: String,
        enum: ["receipt", "stock_out", "adjustment", "supply_receipt", "order_fulfillment"],
        required: true
    },
    quantity: { type: Number, required: true, min: 1 },
    beforeQuantity: { type: Number, required: true, min: 0 },
    afterQuantity: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 500, default: "" },
    reference: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });

stockTransactionSchema.index({ warehouse: 1, createdAt: -1 });
stockTransactionSchema.index({ product: 1, createdAt: -1 });

const stockTransactionModel = mongoose.model("stockTransaction", stockTransactionSchema);
export default stockTransactionModel;
