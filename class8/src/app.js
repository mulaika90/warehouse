import express  from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import warehouseRoutes from "./routes/warehouse.routes.js";
import supplierRoutes from "./routes/supplier.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import cookieParser from "cookie-parser";
const app = express();
const allowedOrigins = new Set(
    (
        process.env.FRONTEND_ORIGINS
        || "http://localhost:5173,https://mern-stack-hackathon-7xqr.vercel.app"
    )
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean)
);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/product", productRoutes);

const frontendBuildPath = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
app.use(express.static(frontendBuildPath));
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api/") || !req.accepts("html")) {
        return next();
    }
    return res.sendFile(fileURLToPath(new URL("../../frontend/dist/index.html", import.meta.url)));
});

app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
    if (status >= 500) console.error("API request failed:", error.message);
    return res.status(status).json({
        message: status >= 500 ? "The request could not be completed." : error.message
    });
});

export default app;