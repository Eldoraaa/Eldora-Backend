CREATE TABLE "TrNotificationUserState" (
  "id" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,

  CONSTRAINT "TrNotificationUserState_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TrNotificationUserState" ("id", "readAt", "createdAt", "updatedAt", "notificationId", "userId")
SELECT CONCAT('c', md5(random()::text || clock_timestamp()::text || "id" || "userId")), "readAt", "createdAt", NOW(), "id", "userId"
FROM "TrNotification"
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "TrNotificationUserState_notificationId_userId_key" ON "TrNotificationUserState"("notificationId", "userId");
CREATE INDEX "TrNotificationUserState_userId_readAt_idx" ON "TrNotificationUserState"("userId", "readAt");

ALTER TABLE "TrNotificationUserState"
ADD CONSTRAINT "TrNotificationUserState_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "TrNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrNotificationUserState"
ADD CONSTRAINT "TrNotificationUserState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "MsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
