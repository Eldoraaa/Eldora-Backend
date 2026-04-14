import { config } from "@/config/env";
import { initFirebase } from "@/config/firebase";
import { prisma } from "@/config/database";
import app from "./app";

async function bootstrap(): Promise<void> {
  initFirebase();

  await prisma.$connect();
  console.log("[DB] Connected to PostgreSQL");

  const server = app.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Server] ${signal} received — shutting down...`);
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
