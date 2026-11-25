import express from "express";
import { getCurrentUser, getProfileImage, loginUser, logoutUser, registerUser, updateProfile } from "../controllers/auth.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

function handleProfileUpload(req, res, next) {
    upload.single("avatar")(req, res, (error) => {
        if (error) {
            const tooLarge = error.code === "LIMIT_FILE_SIZE";
            return res.status(tooLarge ? 413 : 400).json({
                message: tooLarge ? "The profile image must be smaller than 5 MB." : error.message
            });
        }
        return next();
    });
}

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", authenticateToken, getCurrentUser);
router.get("/profile-image/:id", authenticateToken, getProfileImage);
router.patch("/profile", authenticateToken, handleProfileUpload, updateProfile);
router.post("/logout", logoutUser);

export default router;