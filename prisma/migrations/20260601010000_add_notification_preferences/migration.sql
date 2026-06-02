CREATE TABLE "MsNotificationPreference" (
    "id" TEXT NOT NULL,
    "deviceAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dndEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dndStartTime" TEXT,
    "dndEndTime" TEXT,
    "systemNotificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "homeAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fallAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sosAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deviceOfflineAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowBatteryAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pairingRequestAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bulletinEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fcmToken" TEXT,
    "fcmPlatform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MsNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MsNotificationPreference_userId_key" ON "MsNotificationPreference"("userId");

ALTER TABLE "MsNotificationPreference" ADD CONSTRAINT "MsNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
