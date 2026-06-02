DO $$
BEGIN
  IF to_regclass('"User"') IS NOT NULL AND to_regclass('"MsUser"') IS NULL THEN
    ALTER TABLE "User" RENAME TO "MsUser";
  END IF;

  IF to_regclass('"Home"') IS NOT NULL AND to_regclass('"MsHome"') IS NULL THEN
    ALTER TABLE "Home" RENAME TO "MsHome";
  END IF;

  IF to_regclass('"HomeMember"') IS NOT NULL AND to_regclass('"TrHomeMember"') IS NULL THEN
    ALTER TABLE "HomeMember" RENAME TO "TrHomeMember";
  END IF;

  IF to_regclass('"HomeInvitation"') IS NOT NULL AND to_regclass('"TrHomeInvitation"') IS NULL THEN
    ALTER TABLE "HomeInvitation" RENAME TO "TrHomeInvitation";
  END IF;

  IF to_regclass('"ElderProfile"') IS NOT NULL AND to_regclass('"MsElderProfile"') IS NULL THEN
    ALTER TABLE "ElderProfile" RENAME TO "MsElderProfile";
  END IF;

  IF to_regclass('"Device"') IS NOT NULL AND to_regclass('"MsDevice"') IS NULL THEN
    ALTER TABLE "Device" RENAME TO "MsDevice";
  END IF;

  IF to_regclass('"DeviceCommand"') IS NOT NULL AND to_regclass('"TrDeviceCommand"') IS NULL THEN
    ALTER TABLE "DeviceCommand" RENAME TO "TrDeviceCommand";
  END IF;

  IF to_regclass('"DevicePairingRequest"') IS NOT NULL AND to_regclass('"TrDevicePairingRequest"') IS NULL THEN
    ALTER TABLE "DevicePairingRequest" RENAME TO "TrDevicePairingRequest";
  END IF;

  IF to_regclass('"RoomCategory"') IS NOT NULL AND to_regclass('"MsRoomCategory"') IS NULL THEN
    ALTER TABLE "RoomCategory" RENAME TO "MsRoomCategory";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TrElderProfileUser" (
  "elderProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrElderProfileUser_pkey" PRIMARY KEY ("elderProfileId", "userId"),
  CONSTRAINT "TrElderProfileUser_elderProfileId_fkey"
    FOREIGN KEY ("elderProfileId") REFERENCES "MsElderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrElderProfileUser_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "MsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "TrElderProfileUser" ("elderProfileId", "userId")
SELECT "A", "B"
FROM "_ElderProfileToUser"
ON CONFLICT ("elderProfileId", "userId") DO NOTHING;

CREATE INDEX IF NOT EXISTS "TrElderProfileUser_userId_idx"
ON "TrElderProfileUser"("userId");

DROP TABLE IF EXISTS "_ElderProfileToUser";
