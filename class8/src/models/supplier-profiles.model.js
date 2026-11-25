import mongoose from "mongoose";

const supplierProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, unique: true },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    address: { type: String, trim: true, maxlength: 250, default: "" },
    logoUrl: { type: String, default: "" }
}, { timestamps: true });

const supplierProfileModel = mongoose.model("supplierProfile", supplierProfileSchema);
export default supplierProfileModel;
