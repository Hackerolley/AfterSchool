import { config } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { User, hashPassword } from "../modules/users/user.model.js";

const firstName = process.env.PLATFORM_ADMIN_FIRST_NAME?.trim();
const lastName = process.env.PLATFORM_ADMIN_LAST_NAME?.trim();
const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD;

if (!firstName || !lastName || !email || !password) {
  throw new Error(
    "Set PLATFORM_ADMIN_FIRST_NAME, PLATFORM_ADMIN_LAST_NAME, PLATFORM_ADMIN_EMAIL, and PLATFORM_ADMIN_PASSWORD",
  );
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("PLATFORM_ADMIN_EMAIL must be a valid email address");
}
if (password.length < 12 || password.length > 128) {
  throw new Error("PLATFORM_ADMIN_PASSWORD must be between 12 and 128 characters");
}

try {
  await connectDatabase(config.MONGODB_URI);
  if (await User.exists({ email })) {
    throw new Error("An account with this email already exists");
  }
  await User.create({
    firstName,
    lastName,
    email,
    passwordHash: await hashPassword(password),
    platformRole: "platform_admin",
  });
  console.info("Created platform administrator.");
} catch (error) {
  console.error("Platform administrator bootstrap failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
