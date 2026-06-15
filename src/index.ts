import express from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { config, initFirebase, prisma, swaggerSpec } from "@/config";
import { errorHandler, requestLogger } from "@/middlewares";
import authRoutes from "@/modules/auth";
import homeRoutes from "@/modules/home";
import iotRoutes from "@/modules/iot";
import { processStaleDeviceOfflineEvents } from "@/modules/iot/iot.service";
import devicesRoutes from "@/modules/devices";
import notificationRoutes from "@/modules/notifications";
import { processAllDueFollowUps } from "@/modules/notifications/notifications.service";
import sceneRoutes from "@/modules/scenes";
import voiceRoutes from "@/modules/voice";
import { analyticsRouter as analyticsRoutes } from "@/modules/analytics";
import { processDueScheduledScenes } from "@/modules/scenes/scenes.service";

const app = express();

// Security & logging
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Check API health
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-05-25T13:00:00.000Z
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use("/auth", authRoutes);
app.use("/home", homeRoutes);
app.use("/iot", iotRoutes);
app.use("/devices", devicesRoutes);
app.use("/notifications", notificationRoutes);
app.use("/scenes", sceneRoutes);
app.use("/voice", voiceRoutes);
app.use("/analytics", analyticsRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
});

// Error handler
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  initFirebase();

  await prisma.$connect();
  console.log("[DB] Connected to PostgreSQL");

  const server = app.listen(config.port, () => {
    console.log(
      `[Server] Running on http://localhost:${config.port} (${config.nodeEnv})`,
    );
  });

  const followUpInterval = setInterval(() => {
    void processAllDueFollowUps().catch((error) => {
      console.warn("[Notifications] Follow-up processor failed:", error);
    });
  }, 60_000);
  const scheduledSceneInterval = setInterval(() => {
    void processDueScheduledScenes().catch((error) => {
      console.warn("[Scenes] Scheduled scene processor failed:", error);
    });
  }, 60_000);
  const offlineDetectorInterval = setInterval(() => {
    void processStaleDeviceOfflineEvents().catch((error) => {
      console.warn("[IoT] Offline detector failed:", error);
    });
  }, 60_000);

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Server] ${signal} received - shutting down...`);
    clearInterval(followUpInterval);
    clearInterval(scheduledSceneInterval);
    clearInterval(offlineDetectorInterval);
    server.close(async () => {
      await prisma.$disconnect();
      console.log("[Server] Closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error("[Server] Bootstrap failed:", err);
  process.exit(1);
});

export default app;
