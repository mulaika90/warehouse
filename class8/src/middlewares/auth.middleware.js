import jwt from "jsonwebtoken";
import userModel from "../models/users.model.js";

export async function authenticateToken(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: "Invalid token." });
    }

    const user = await userModel.findById(payload.id)
        .select("_id role assignedWarehouses isActive");
    if (!user || !user.isActive) {
        return res.status(401).json({ message: "Your account is no longer active." });
    }

    req.user = {
        id: user._id.toString(),
        role: user.role,
        assignedWarehouses: user.assignedWarehouses || []
    };
    return next();
}

export function requireAdmin(req, res, next) {
    if (req.user?.role !== "admin") {
        return res.status(403).json({
            message: "Administrator access is required for this resource. Sign in with an admin account."
        });
    }
    return next();
}

export function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "You do not have permission to perform this action." });
        }
        return next();
    };
}
