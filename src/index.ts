import express, { Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { config, initFirebase, prisma, swaggerSpec } from "@/config";
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

// Docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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

async function bootstrap(): Promise<void> {
  initFirebase();

  await prisma.$connect();
  console.log("[DB] Connected to PostgreSQL");

  const server = app.listen(config.port, () => {
    console.log(
      `[Server] Running on http://localhost:${config.port} (${config.nodeEnv})`,
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Server] ${signal} received - shutting down...`);
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
