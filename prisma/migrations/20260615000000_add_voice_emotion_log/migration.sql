-- CreateEnum
CREATE TYPE "VoiceEmotionState" AS ENUM ('neutral', 'calm', 'happy', 'sad', 'anxious', 'distressed');

-- CreateTable
CREATE TABLE "TrVoiceEmotionLog" (
    "id"             TEXT NOT NULL,
    "emotionState"   "VoiceEmotionState" NOT NULL DEFAULT 'neutral',
    "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transcript"     TEXT,
    "intent"         TEXT,
    "responseSource" TEXT,
    "latencyMs"      DOUBLE PRECISION,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId"       TEXT NOT NULL,

    CONSTRAINT "TrVoiceEmotionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrVoiceEmotionLog_deviceId_createdAt_idx" ON "TrVoiceEmotionLog"("deviceId", "createdAt");

-- CreateIndex
CREATE INDEX "TrVoiceEmotionLog_emotionState_createdAt_idx" ON "TrVoiceEmotionLog"("emotionState", "createdAt");

-- AddForeignKey
ALTER TABLE "TrVoiceEmotionLog"
    ADD CONSTRAINT "TrVoiceEmotionLog_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "MsDevice"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
