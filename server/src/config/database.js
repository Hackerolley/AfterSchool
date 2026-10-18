import mongoose from "mongoose";

export async function connectDatabase(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.info("Connected to MongoDB");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export function getDatabaseState() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}
