import express from "express";
import {
    createSupplyRequest,
    getSupplierProfile,
    listSupplierCatalog,
    listSupplierProducts,
    listSupplyRequests,
    updateSupplierProfile
} from "../controllers/supplier.controller.js";
import { authenticateToken, authorizeRoles } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

function handleSupplierLogoUpload(req, res, next) {
    upload.single("logo")(req, res, (error) => {
        if (error) {
            const tooLarge = error.code === "LIMIT_FILE_SIZE";
            return res.status(tooLarge ? 413 : 400).json({
                message: tooLarge ? "The supplier logo must be smaller than 5 MB." : error.message
            });
        }
        return next();
    });
}

router.use(authenticateToken, authorizeRoles("supplier"));
router.get("/profile", getSupplierProfile);
router.put("/profile", handleSupplierLogoUpload, updateSupplierProfile);
router.get("/catalog", listSupplierCatalog);
router.get("/products", listSupplierProducts);
router.get("/requests", listSupplyRequests);
router.post("/requests", createSupplyRequest);

export default router;
