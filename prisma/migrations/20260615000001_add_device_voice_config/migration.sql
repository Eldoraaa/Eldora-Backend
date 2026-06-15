-- CreateTable
CREATE TABLE "MsDeviceVoiceConfig" (
    "id"        TEXT NOT NULL,
    "enabled"   BOOLEAN NOT NULL DEFAULT true,
    "language"  TEXT NOT NULL DEFAULT 'en',
    "ttsVoice"  TEXT NOT NULL DEFAULT 'en-US-JennyNeural',
    "ttsRate"   TEXT NOT NULL DEFAULT '-5%',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deviceId"  TEXT NOT NULL,

    CONSTRAINT "MsDeviceVoiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MsDeviceVoiceConfig_deviceId_key" ON "MsDeviceVoiceConfig"("deviceId");

-- AddForeignKey
ALTER TABLE "MsDeviceVoiceConfig"
    ADD CONSTRAINT "MsDeviceVoiceConfig_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "MsDevice"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
