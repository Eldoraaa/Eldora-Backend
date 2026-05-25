import express from "express";
import helmet from "helmet";
import cors from "cors";
import { errorHandler, requestLogger } from "@/middlewares";
import authRoutes from "@/modules/auth";
import homeRoutes from "@/modules/home";
import iotRoutes from "@/modules/iot";
import devicesRoutes from "@/modules/devices";

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
app.use("/iot", iotRoutes);
app.use("/devices", devicesRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
});

// Error handler
app.use(errorHandler);

export default app;
