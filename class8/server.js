import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import connectDB from "./src/db/db.js";
import userModel from "./src/models/users.model.js";

const envPath = fileURLToPath(new URL("./.env", import.meta.url));

if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const { default: app } = await import("./src/app.js");
const port = Number(process.env.PORT) || 3000;

async function startServer() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Add it to the backend .env file.");
  }

  await connectDB();
  await migrateLegacyRoles();
  await ensureAdminAccount();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

async function ensureAdminAccount() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME } = process.env;
  if (!ADMIN_EMAIL && !ADMIN_PASSWORD && !ADMIN_USERNAME) return;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_USERNAME) {
    throw new Error("Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_USERNAME together to configure the warehouse administrator.");
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existingAdmin = await userModel.findOne({ email });
  if (existingAdmin) {
    if (!["admin", "warehouse_manager", "supplier", "sales_rep", "patient", "doctor", "user"].includes(existingAdmin.role)) {
      throw new Error("ADMIN_EMAIL belongs to an unsupported account. Choose a different administrator email.");
    }
    const username = ADMIN_USERNAME.trim();
    const passwordMatches = await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.password);
    if (existingAdmin.role !== "admin" || existingAdmin.username !== username || !passwordMatches) {
      const usernameInUse = await userModel.findOne({
        username,
        _id: { $ne: existingAdmin._id }
      }).select("_id");
      if (usernameInUse) {
        throw new Error("ADMIN_USERNAME is already in use. Choose a different administrator username.");
      }
      existingAdmin.role = "admin";
      existingAdmin.username = username;
      existingAdmin.password = passwordMatches
        ? existingAdmin.password
        : await bcrypt.hash(ADMIN_PASSWORD, 10);
      await existingAdmin.save();
      console.log("Warehouse administrator account credentials were synchronized.");
    }
    return;
  }

  await userModel.create({
    username: ADMIN_USERNAME.trim(),
    email,
    password: await bcrypt.hash(ADMIN_PASSWORD, 10),
    role: "admin"
  });
  console.log("Warehouse administrator account is ready.");
}

async function migrateLegacyRoles() {
  const [customers, staff] = await Promise.all([
    userModel.updateMany({ role: { $in: ["patient", "user"] } }, { $set: { role: "sales_rep" } }),
    userModel.updateMany({ role: "doctor" }, { $set: { role: "warehouse_manager" } })
  ]);
  const migrated = (customers.modifiedCount || 0) + (staff.modifiedCount || 0);
  if (migrated) console.log(`Migrated ${migrated} legacy account(s) to warehouse roles.`);
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exitCode = 1;
});