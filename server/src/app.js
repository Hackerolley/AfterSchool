import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import { csrfProtection } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import apiRoutes from "./routes/index.js";

export function createApp({ config, sessionStore, getDatabaseState }) {
  if (!config || !sessionStore || !getDatabaseState) {
    throw new Error("Application config, session store, and database health check are required");
  }

  const app = express();
  app.locals.config = config;
  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        frameSrc: ["'self'", "https://www.youtube-nocookie.com"],
        mediaSrc: ["'self'", "https://verses.quran.com", "https://download.quranicaudio.com"],
      },
    },
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Organization-Id"],
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(session({
    name: "afterschool.sid",
    secret: config.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.NODE_ENV === "production" || config.COOKIE_SAME_SITE === "none",
      sameSite: config.COOKIE_SAME_SITE,
      maxAge: config.SESSION_MAX_AGE_MS,
      path: "/",
    },
  }));
  app.use(csrfProtection);

  app.get("/api/v1/health", (req, res) => {
    const database = getDatabaseState();
    const healthy = database === "connected";
    res.status(healthy ? 200 : 503).json({
      success: healthy,
      data: { status: healthy ? "ok" : "unavailable", database },
    });
  });
  app.use("/api/v1", apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
