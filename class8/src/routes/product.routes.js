import express from "express";
import { createProduct, deleteProduct, getProducts, updateProduct } from "../controllers/product.controller.js";
import { authenticateToken, authorizeRoles, requireAdmin } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

function handleProductUpload(req, res, next) {
    upload.single("image")(req, res, (error) => {
        if (error) {
            const tooLarge = error.code === "LIMIT_FILE_SIZE";
            return res.status(tooLarge ? 413 : 400).json({
                message: tooLarge ? "The product image must be smaller than 5 MB." : error.message
            });
        }
        return next();
    });
}

router.get("/", authenticateToken, authorizeRoles("admin", "warehouse_manager", "supplier", "sales_rep"), getProducts);
router.post("/create", authenticateToken, authorizeRoles("admin", "warehouse_manager"), handleProductUpload, createProduct);
router.patch("/:id", authenticateToken, authorizeRoles("admin", "warehouse_manager"), handleProductUpload, updateProduct);
router.delete("/:id", authenticateToken, requireAdmin, deleteProduct);

export default router;