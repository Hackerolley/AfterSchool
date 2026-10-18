import MongoStore from "connect-mongo";
import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { connectDatabase, disconnectDatabase, getDatabaseState } from "./config/database.js";

function logDatabaseStartupError(error) {
  console.error("Failed to connect to MongoDB; the API server was not started.");
  console.error(`Database error: ${error.name ?? "Error"}`);

  const failures = new Set();
  for (const serverDescription of error.reason?.servers?.values() ?? []) {
    const serverError = serverDescription.error;
    const code = serverError?.cause?.code ?? serverError?.code;
    const reason = serverError?.cause?.reason;
    if (code) failures.add(`${code}${reason ? ` (${reason})` : ""}`);
  }
  for (const failure of failures) console.error(`MongoDB transport error: ${failure}`);

  if ([...failures].some((failure) => failure.includes("TLS") || failure.includes("SSL"))) {
    console.error(
      "Check that the Atlas cluster is running, this network's IP is allowed in Atlas Network Access, and a VPN/proxy/firewall is not interrupting TLS.",
    );
  } else {
    console.error(
      "Check the MongoDB URI, Atlas cluster state, Atlas Network Access IP list, and network connectivity.",
    );
  }
}

async function startServer() {
  try {
    await connectDatabase(config.MONGODB_URI);
  } catch (error) {
    logDatabaseStartupError(error);
    try {
      await disconnectDatabase();
    } catch (disconnectError) {
      console.error("MongoDB cleanup after startup failure failed", disconnectError.name);
    }
    process.exitCode = 1;
    return;
  }

  const sessionStore = MongoStore.create({
    mongoUrl: config.MONGODB_URI,
    collectionName: "sessions",
    ttl: Math.ceil(config.SESSION_MAX_AGE_MS / 1000),
  });
  const app = createApp({ config, sessionStore, getDatabaseState });
  const server = app.listen(config.PORT, () => {
    console.info(`AfterSchool API listening on port ${config.PORT}`);
  });

  let isShuttingDown = false;
  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.info(`Received ${signal}; shutting down`);
    server.close(async (error) => {
      if (error) {
        console.error("HTTP server shutdown failed", error);
        process.exitCode = 1;
      }
      try {
        await sessionStore.close();
        await disconnectDatabase();
      } catch (shutdownError) {
        console.error("Shutdown cleanup failed", shutdownError);
        process.exitCode = 1;
      }
    });
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

await startServer();
