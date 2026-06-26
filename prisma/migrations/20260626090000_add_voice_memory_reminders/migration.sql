-- CreateEnum
CREATE TYPE "ElderReminderSource" AS ENUM ('voice', 'caregiver', 'scene');

-- CreateEnum
CREATE TYPE "ElderReminderStatus" AS ENUM ('pending', 'delivered', 'acknowledged', 'cancelled', 'failed', 'needs_confirmation');

-- CreateEnum
CREATE TYPE "SceneReminderDeliveryMode" AS ENUM ('conversation_append', 'scheduled_speak');

-- CreateTable
CREATE TABLE "TrVoiceConversationTurn" (
    "id" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "responseText" TEXT,
    "intent" TEXT,
    "emotionState" "VoiceEmotionState" NOT NULL DEFAULT 'neutral',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseSource" TEXT,
    "latencyMs" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elderProfileId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "TrVoiceConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MsElderMemoryFact" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "elderProfileId" TEXT NOT NULL,
    "sourceTurnId" TEXT,

    CONSTRAINT "MsElderMemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MsElderContextSummary" (
    "id" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "safetySummary" TEXT NOT NULL DEFAULT '',
    "preferenceSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "elderProfileId" TEXT NOT NULL,

    CONSTRAINT "MsElderContextSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrElderReminder" (
    "id" TEXT NOT NULL,
    "source" "ElderReminderSource" NOT NULL DEFAULT 'voice',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "recurrenceRule" TEXT,
    "status" "ElderReminderStatus" NOT NULL DEFAULT 'pending',
    "createdFromTurnId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "elderProfileId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "homeId" TEXT,

    CONSTRAINT "TrElderReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrSceneReminderDelivery" (
    "id" TEXT NOT NULL,
    "deliveryMode" "SceneReminderDeliveryMode" NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sceneId" TEXT NOT NULL,
    "elderProfileId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "TrSceneReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrVoiceConversationTurn_elderProfileId_createdAt_idx" ON "TrVoiceConversationTurn"("elderProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "TrVoiceConversationTurn_deviceId_createdAt_idx" ON "TrVoiceConversationTurn"("deviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MsElderMemoryFact_elderProfileId_key_key" ON "MsElderMemoryFact"("elderProfileId", "key");

-- CreateIndex
CREATE INDEX "MsElderMemoryFact_elderProfileId_type_status_idx" ON "MsElderMemoryFact"("elderProfileId", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MsElderContextSummary_elderProfileId_key" ON "MsElderContextSummary"("elderProfileId");

-- CreateIndex
CREATE INDEX "TrElderReminder_elderProfileId_status_dueAt_idx" ON "TrElderReminder"("elderProfileId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "TrElderReminder_deviceId_status_dueAt_idx" ON "TrElderReminder"("deviceId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "TrElderReminder_homeId_status_dueAt_idx" ON "TrElderReminder"("homeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "TrSceneReminderDelivery_sceneId_deliveredAt_idx" ON "TrSceneReminderDelivery"("sceneId", "deliveredAt");

-- CreateIndex
CREATE INDEX "TrSceneReminderDelivery_elderProfileId_deliveredAt_idx" ON "TrSceneReminderDelivery"("elderProfileId", "deliveredAt");

-- CreateIndex
CREATE INDEX "TrSceneReminderDelivery_deviceId_deliveredAt_idx" ON "TrSceneReminderDelivery"("deviceId", "deliveredAt");

-- AddForeignKey
ALTER TABLE "TrVoiceConversationTurn" ADD CONSTRAINT "TrVoiceConversationTurn_elderProfileId_fkey" FOREIGN KEY ("elderProfileId") REFERENCES "MsElderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrVoiceConversationTurn" ADD CONSTRAINT "TrVoiceConversationTurn_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MsDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MsElderMemoryFact" ADD CONSTRAINT "MsElderMemoryFact_elderProfileId_fkey" FOREIGN KEY ("elderProfileId") REFERENCES "MsElderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MsElderContextSummary" ADD CONSTRAINT "MsElderContextSummary_elderProfileId_fkey" FOREIGN KEY ("elderProfileId") REFERENCES "MsElderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrElderReminder" ADD CONSTRAINT "TrElderReminder_elderProfileId_fkey" FOREIGN KEY ("elderProfileId") REFERENCES "MsElderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrElderReminder" ADD CONSTRAINT "TrElderReminder_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MsDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrElderReminder" ADD CONSTRAINT "TrElderReminder_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "MsHome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrSceneReminderDelivery" ADD CONSTRAINT "TrSceneReminderDelivery_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "MsScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrSceneReminderDelivery" ADD CONSTRAINT "TrSceneReminderDelivery_elderProfileId_fkey" FOREIGN KEY ("elderProfileId") REFERENCES "MsElderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrSceneReminderDelivery" ADD CONSTRAINT "TrSceneReminderDelivery_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MsDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
