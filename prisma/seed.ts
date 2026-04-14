import "dotenv/config";
import * as crypto from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("🌱 Seeding database...");

  // Create family user
  const hashedPassword = await bcrypt.hash("password123", 10);
  const user = await prisma.user.upsert({
    where: { email: "family@eldora.com" },
    update: {},
    create: {
      email: "family@eldora.com",
      password: hashedPassword,
      name: "Ahmad Keluarga",
      role: "family",
    },
  });
  console.log(`✅ User: ${user.email}`);

  // Create elder profile
  const elderProfile = await prisma.elderProfile.upsert({
    where: { id: "elder-profile-seed-01" },
    update: {},
    create: {
      id: "elder-profile-seed-01",
      name: "Ibu Sari",
      users: { connect: { id: user.id } },
    },
  });
  console.log(`✅ Elder Profile: ${elderProfile.name}`);

  // Create device with random deviceKey
  const deviceKey = crypto.randomBytes(24).toString("hex");
  const device = await prisma.device.upsert({
    where: { deviceId: "ESP32-001" },
    update: {},
    create: {
      deviceId: "ESP32-001",
      deviceKey,
      name: "Perangkat Kamar Tidur",
      elderProfileId: elderProfile.id,
    },
  });
  console.log(`✅ Device: ${device.deviceId}`);
  console.log(`\n🔑 DEVICE_KEY: ${deviceKey}`);
  console.log("   Simpan key ini untuk testing IoT endpoints!\n");
}

main()
  .catch((err) => {
    console.error("❌ Seed gagal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
