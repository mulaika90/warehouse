import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 250, default: "" },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const warehouseModel = mongoose.model("warehouse", warehouseSchema);
export default warehouseModel;
