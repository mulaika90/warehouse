import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/users.model.js";

const publicUserFields = "_id username email role assignedWarehouses profileImage isActive";
const publicSignupRoles = ["supplier", "sales_rep"];

function publicUser(user) {
    return {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        assignedWarehouses: user.assignedWarehouses || [],
        profileImage: user.profileImage || ""
    };
}

function issueToken(user, res) {
    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("token", token, {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
}

export async function registerUser(req, res) {
    const username = req.body.username?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const role = req.body.role;

    if (!username || username.length < 2 || username.length > 80 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Enter a valid name and email address." });
    }
    if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    if (!publicSignupRoles.includes(role)) {
        return res.status(400).json({ message: "Public registration is available for suppliers and sales representatives only." });
    }

    const existing = await userModel.findOne({ $or: [{ username }, { email }] }).select("_id");
    if (existing) {
        return res.status(409).json({ message: "An account with that name or email already exists." });
    }

    let user;
    try {
        user = await userModel.create({
            username,
            email,
            password: await bcrypt.hash(password, 10),
            role
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: "An account with that name or email already exists." });
        }
        throw error;
    }

    issueToken(user, res);
    return res.status(201).json({
        message: "Your warehouse account is ready.",
        user: publicUser(user)
    });
}

export async function loginUser(req, res) {
    const identity = req.body.identity?.trim() || req.body.username?.trim() || req.body.email?.trim();
    const password = req.body.password;

    if (!identity || typeof password !== "string" || !password) {
        return res.status(400).json({ message: "Enter your email or username and password." });
    }

    const user = await userModel.findOne({
        $or: [{ username: identity }, { email: identity.toLowerCase() }]
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "That email, username, or password is incorrect." });
    }
    if (!user.isActive) {
        return res.status(403).json({ message: "This account is deactivated. Contact an administrator." });
    }

    issueToken(user, res);
    return res.status(200).json({ message: "Welcome back.", user: publicUser(user) });
}

export async function getCurrentUser(req, res) {
    const user = await userModel.findById(req.user.id)
        .select(publicUserFields)
        .populate("assignedWarehouses", "name code");
    if (!user || !user.isActive) {
        res.clearCookie("token");
        return res.status(401).json({ message: "Your session is no longer active. Please sign in again." });
    }

    return res.status(200).json({ user: publicUser(user) });
}

export async function updateProfile(req, res) {
    try {
        const username = req.body.username?.trim();

        if (!username || username.length < 2 || username.length > 80) {
            return res.status(400).json({ message: "Username must be between 2 and 80 characters." });
        }

        const existing = await userModel.findOne({ _id: { $ne: req.user.id }, username }).select("_id");
        if (existing) {
            return res.status(409).json({ message: "That username is already in use." });
        }

        const updates = { username };
        if (req.file) {
            updates.profileImage = `/api/auth/profile-image/${req.user.id}`;
            updates.profileImageData = req.file.buffer;
            updates.profileImageContentType = req.file.mimetype;
        }

        const user = await userModel.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select(publicUserFields);

        if (!user || !user.isActive) {
            return res.status(401).json({ message: "Your account is no longer active." });
        }

        return res.status(200).json({
            message: "Your profile has been updated.",
            user: publicUser(user)
        });
    } catch (error) {
        if (error.code === 11000 && error.keyPattern?.username) {
            return res.status(409).json({ message: "That username is already in use." });
        }
        console.error("Profile update failed:", error);
        return res.status(500).json({ message: "Profile update failed. Please try again." });
    }
}

export async function getProfileImage(req, res) {
    const target = await userModel.findById(req.params.id)
        .select("+profileImageData +profileImageContentType role");
    if (!target?.profileImageData || !target.profileImageContentType) {
        return res.status(404).json({ message: "Profile image not found." });
    }

    if (req.user.role !== "admin" && req.user.id !== target.id) {
        return res.status(403).json({ message: "You cannot view this profile image." });
    }

    res.set({
        "Content-Type": target.profileImageContentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff"
    });
    return res.status(200).send(target.profileImageData);
}

export function logoutUser(_req, res) {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction
    });
    return res.status(200).json({ message: "You have been signed out." });
}
