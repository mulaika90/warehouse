import mongoose from "mongoose";

export default async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to the backend .env file.");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}
