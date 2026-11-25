import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: "sales_rep",
        enum: ["admin", "warehouse_manager", "supplier", "sales_rep"]
    },
    assignedWarehouses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "warehouse"
    }],
    specialization: {
        type: String,
        trim: true,
        default: ""
    },
    experience: {
        type: Number,
        min: 0,
        default: 0
    },
    profileImage: {
        type: String,
        default: ""
    },
    profileImageData: {
        type: Buffer,
        select: false
    },
    profileImageContentType: {
        type: String,
        enum: ["image/jpeg", "image/png", "image/webp"],
        select: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    cart: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "product",
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1
        }
    }]
}, { timestamps: true });

const userModel = mongoose.model("user", userSchema);
export default userModel;
