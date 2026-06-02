CREATE TYPE "NotificationType" AS ENUM (
    'alarm',
    'home',
    'device'
);

CREATE TABLE "TrNotification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "homeId" TEXT,
    "deviceId" TEXT,

    CONSTRAINT "TrNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrNotification_userId_type_createdAt_idx" ON "TrNotification"("userId", "type", "createdAt");
CREATE INDEX "TrNotification_homeId_idx" ON "TrNotification"("homeId");
CREATE INDEX "TrNotification_deviceId_idx" ON "TrNotification"("deviceId");

ALTER TABLE "TrNotification" ADD CONSTRAINT "TrNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrNotification" ADD CONSTRAINT "TrNotification_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "MsHome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrNotification" ADD CONSTRAINT "TrNotification_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MsDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
