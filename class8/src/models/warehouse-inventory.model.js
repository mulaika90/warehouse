import mongoose from "mongoose";

const warehouseInventorySchema = new mongoose.Schema({
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: "warehouse", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "product", required: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    reorderLevel: { type: Number, required: true, min: 0, default: 5 },
    binLocation: { type: String, trim: true, maxlength: 100, default: "" }
}, { timestamps: true });

warehouseInventorySchema.index({ warehouse: 1, product: 1 }, { unique: true });
warehouseInventorySchema.index({ warehouse: 1, quantity: 1, reorderLevel: 1 });

const warehouseInventoryModel = mongoose.model("warehouseInventory", warehouseInventorySchema);
export default warehouseInventoryModel;
