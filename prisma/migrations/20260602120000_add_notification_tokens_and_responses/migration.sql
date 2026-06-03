CREATE TABLE "MsNotificationDeviceToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT,
  "deviceId" TEXT,
  "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "MsNotificationDeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MsNotificationDeviceToken_token_key" ON "MsNotificationDeviceToken"("token");
CREATE INDEX "MsNotificationDeviceToken_userId_idx" ON "MsNotificationDeviceToken"("userId");
ALTER TABLE "MsNotificationDeviceToken" ADD CONSTRAINT "MsNotificationDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TrNotificationResponse" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "TrNotificationResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrNotificationResponse_notificationId_createdAt_idx" ON "TrNotificationResponse"("notificationId", "createdAt");
ALTER TABLE "TrNotificationResponse" ADD CONSTRAINT "TrNotificationResponse_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "TrNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrNotificationResponse" ADD CONSTRAINT "TrNotificationResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
