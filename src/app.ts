import express from "express";
import helmet from "helmet";
import cors from "cors";
import { requestLogger } from "@/middlewares/logger.middleware";
import { errorHandler } from "@/middlewares/error.middleware";
import authRoutes from "@/routes/auth.routes";
import homeRoutes from "@/routes/home.routes";
import alertsRoutes from "@/routes/alerts.routes";
import iotRoutes from "@/routes/iot.routes";

const app = express();

// Security & logging
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/auth", authRoutes);
app.use("/home", homeRoutes);
app.use("/alerts", alertsRoutes);
app.use("/iot", iotRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
});

// Error handler
app.use(errorHandler);

export default app;
