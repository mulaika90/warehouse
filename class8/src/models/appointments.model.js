import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    appointmentDate: {
        type: Date,
        required: true
    },
    appointmentTime: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "cancelled"],
        default: "pending"
    }
}, { timestamps: true });

appointmentSchema.index({ doctor: 1, appointmentDate: 1, appointmentTime: 1 });
appointmentSchema.index({ patient: 1, appointmentDate: -1 });
appointmentSchema.index(
    { patient: 1, doctor: 1, appointmentDate: 1, appointmentTime: 1 },
    { unique: true, name: "unique_patient_doctor_appointment_slot" }
);
appointmentSchema.index(
    { doctor: 1, appointmentDate: 1, appointmentTime: 1 },
    {
        unique: true,
        name: "unique_active_doctor_appointment_slot",
        partialFilterExpression: { status: { $in: ["pending", "approved"] } }
    }
);

const appointmentModel = mongoose.model("appointment", appointmentSchema);
export default appointmentModel;
