import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import appointmentModel from "../models/appointments.model.js";
import notificationModel from "../models/notifications.model.js";
import userModel from "../models/users.model.js";
import { notifyAdmins, notifyUsers } from "../services/notifications.service.js";

const publicDoctorFields = "_id username email specialization experience profileImage";
const publicAppointmentFields = "patient doctor appointmentDate appointmentTime reason status createdAt updatedAt";
const activeAppointmentStatuses = ["pending", "approved"];
const allowedAppointmentStatuses = ["approved", "rejected"];

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

export async function listDoctors(req, res) {
    const filter = { role: "doctor", isActive: true };
    const search = req.query.search?.trim();
    const specialization = req.query.specialization?.trim();

    if (search) {
        filter.$or = [
            { username: { $regex: search, $options: "i" } },
            { specialization: { $regex: search, $options: "i" } }
        ];
    }
    if (specialization && specialization !== "All specialties") {
        filter.specialization = { $regex: `^${specialization.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
    }

    const doctors = await userModel.find(filter).select(publicDoctorFields).sort({ username: 1 }).lean();
    return res.status(200).json({ doctors });
}

export async function bookAppointment(req, res) {
    const { doctorId, date, time, reason } = req.body;

    if (!isValidObjectId(doctorId)) {
        return res.status(400).json({ message: "Choose a valid doctor." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !/^\d{2}:\d{2}$/.test(time ?? "")) {
        return res.status(400).json({ message: "Choose a valid appointment date and time." });
    }
    const appointmentDate = new Date(`${date}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(appointmentDate.getTime()) || appointmentDate < today) {
        return res.status(400).json({ message: "Appointments must be booked for today or a future date." });
    }
    if (typeof reason !== "string" || reason.trim().length < 3 || reason.trim().length > 500) {
        return res.status(400).json({ message: "Add a short reason for your visit (3–500 characters)." });
    }

    const doctor = await userModel.findOne({ _id: doctorId, role: "doctor", isActive: true }).select("_id");
    if (!doctor) {
        return res.status(404).json({ message: "That doctor is no longer available." });
    }

    const patientDuplicate = await appointmentModel.exists({
        patient: req.user.id,
        doctor: doctor._id,
        appointmentDate,
        appointmentTime: time
    });
    if (patientDuplicate) {
        return res.status(409).json({ message: "You already have an appointment with this doctor at that date and time." });
    }

    const conflictingAppointment = await appointmentModel.exists({
        doctor: doctor._id,
        appointmentDate,
        appointmentTime: time,
        status: { $in: activeAppointmentStatuses }
    });
    if (conflictingAppointment) {
        return res.status(409).json({ message: "That time has just been booked. Please choose another slot." });
    }

    let appointment;
    try {
        appointment = await appointmentModel.create({
            patient: req.user.id,
            doctor: doctor._id,
            appointmentDate,
            appointmentTime: time,
            reason: reason.trim()
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "That appointment time has just been taken. Please choose another slot." });
        }
        throw error;
    }

    await appointment.populate([
        { path: "patient", select: publicDoctorFields },
        { path: "doctor", select: publicDoctorFields }
    ]);
    const appointmentLabel = `${appointment.appointmentDate.toISOString().slice(0, 10)} at ${appointment.appointmentTime}`;
    await Promise.all([
        notifyUsers([appointment.doctor._id], {
            type: "appointment-request",
            title: "New appointment request",
            message: `${appointment.patient.username} requested a visit for ${appointmentLabel}.`,
            appointment: appointment._id
        }),
        notifyAdmins({
            type: "appointment-request",
            title: "New appointment booked",
            message: `${appointment.patient.username} requested an appointment for ${appointmentLabel}.`,
            appointment: appointment._id
        })
    ]);
    return res.status(201).json({ message: "Appointment request sent.", appointment });
}

export async function listMyAppointments(req, res) {
    const appointments = await appointmentModel.find({ patient: req.user.id })
        .populate("doctor", publicDoctorFields)
        .sort({ appointmentDate: -1, appointmentTime: -1 })
        .lean();
    return res.status(200).json({ appointments });
}

export async function listDoctorAppointments(req, res) {
    const appointments = await appointmentModel.find({ doctor: req.user.id })
        .populate("patient", publicDoctorFields)
        .sort({ appointmentDate: 1, appointmentTime: 1 })
        .lean();
    return res.status(200).json({ appointments });
}

export async function updateAppointmentStatus(req, res) {
    const { status } = req.body;
    if (!allowedAppointmentStatuses.includes(status)) {
        return res.status(400).json({ message: "Doctors can approve or reject appointment requests." });
    }
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid appointment." });
    }

    const appointment = await appointmentModel.findOneAndUpdate(
        { _id: req.params.id, doctor: req.user.id, status: "pending" },
        { $set: { status } },
        { new: true, runValidators: true }
    ).populate("patient doctor", publicDoctorFields);

    if (!appointment) {
        return res.status(404).json({ message: "Pending appointment not found." });
    }
    await notifyUsers([appointment.patient._id], {
        type: "appointment-update",
        title: `Appointment ${status}`,
        message: `Dr. ${appointment.doctor.username} ${status} your appointment request.`,
        appointment: appointment._id
    });
    return res.status(200).json({ message: `Appointment ${status}.`, appointment });
}

export async function cancelAppointment(req, res) {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid appointment." });
    }
    const appointment = await appointmentModel.findOneAndUpdate(
        { _id: req.params.id, patient: req.user.id, status: "pending" },
        { $set: { status: "cancelled" } },
        { new: true, runValidators: true }
    ).populate("doctor", publicDoctorFields);

    if (!appointment) {
        return res.status(404).json({ message: "Only your pending appointments can be cancelled." });
    }
    const patient = await userModel.findById(req.user.id).select("username").lean();
    await Promise.all([
        notifyUsers([appointment.doctor._id], {
            type: "appointment-cancelled",
            title: "Appointment cancelled",
            message: `${patient.username} cancelled their appointment request.`,
            appointment: appointment._id
        }),
        notifyAdmins({
            type: "appointment-cancelled",
            title: "Appointment cancelled",
            message: `${patient.username} cancelled an appointment request.`,
            appointment: appointment._id
        })
    ]);
    return res.status(200).json({ message: "Appointment cancelled.", appointment });
}

export async function listAllAppointments(_req, res) {
    const appointments = await appointmentModel.find()
        .populate("patient", publicDoctorFields)
        .populate("doctor", publicDoctorFields)
        .sort({ appointmentDate: -1, appointmentTime: -1 })
        .lean();
    return res.status(200).json({ appointments });
}

export async function getAdminStats(_req, res) {
    const [patients, doctors, appointmentCounts] = await Promise.all([
        userModel.countDocuments({ role: "patient" }),
        userModel.countDocuments({ role: "doctor" }),
        appointmentModel.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ])
    ]);

    const counts = Object.fromEntries(appointmentCounts.map(({ _id, count }) => [_id, count]));
    return res.status(200).json({
        stats: {
            patients,
            doctors,
            appointments: Object.values(counts).reduce((total, count) => total + count, 0),
            pending: counts.pending ?? 0,
            approved: counts.approved ?? 0,
            rejected: counts.rejected ?? 0,
            cancelled: counts.cancelled ?? 0
        }
    });
}

export async function listUsers(req, res) {
    const role = req.query.role;
    const filter = {};
    if (["patient", "doctor", "admin", "user"].includes(role)) filter.role = role;

    const users = await userModel.find(filter)
        .select("_id username email role specialization experience profileImage isActive createdAt")
        .sort({ createdAt: -1 })
        .lean();
    return res.status(200).json({ users });
}

export async function createDoctor(req, res) {
    const username = req.body.username?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const specialization = req.body.specialization?.trim();
    const experience = Number(req.body.experience);

    if (!username || username.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? "")) {
        return res.status(400).json({ message: "Enter a valid doctor name and email address." });
    }
    if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "Doctor password must be at least 8 characters." });
    }
    if (!specialization || specialization.length > 100) {
        return res.status(400).json({ message: "Enter the doctor's specialization." });
    }
    if (!Number.isInteger(experience) || experience < 0 || experience > 70) {
        return res.status(400).json({ message: "Experience must be a whole number between 0 and 70." });
    }

    const existing = await userModel.findOne({ $or: [{ username }, { email }] });
    if (existing) {
        return res.status(409).json({ message: "An account with that name or email already exists." });
    }

    const doctor = await userModel.create({
        username,
        email,
        password: await bcrypt.hash(password, 10),
        role: "doctor",
        specialization,
        experience
    });

    return res.status(201).json({
        message: "Doctor account created.",
        doctor: {
            id: doctor._id,
            username: doctor.username,
            email: doctor.email,
            role: doctor.role,
            specialization: doctor.specialization,
            experience: doctor.experience,
            isActive: doctor.isActive
        }
    });
}

export async function updateUserStatus(req, res) {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid user." });
    }
    if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({ message: "Choose whether this account is active." });
    }

    const user = await userModel.findOneAndUpdate(
        { _id: req.params.id, role: { $in: ["patient", "doctor", "user"] } },
        { $set: { isActive: req.body.isActive } },
        { new: true }
    ).select("_id username email role isActive");

    if (!user) return res.status(404).json({ message: "User not found." });
    return res.status(200).json({ message: "Account status updated.", user });
}

export async function deleteUser(req, res) {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid user." });
    }
    const user = await userModel.findOne({ _id: req.params.id, role: { $in: ["patient", "doctor", "user"] } }).select("_id");
    if (!user) return res.status(404).json({ message: "User not found." });

    const appointments = await appointmentModel.find({
        $or: [{ patient: user._id }, { doctor: user._id }]
    }).select("_id").lean();
    const appointmentIds = appointments.map((appointment) => appointment._id);
    await Promise.all([
        appointmentModel.deleteMany({ _id: { $in: appointmentIds } }),
        notificationModel.deleteMany({
            $or: [
                { recipient: user._id },
                ...(appointmentIds.length ? [{ appointment: { $in: appointmentIds } }] : [])
            ]
        })
    ]);
    await userModel.deleteOne({ _id: user._id });
    return res.status(200).json({ message: "User and associated appointments deleted." });
}
