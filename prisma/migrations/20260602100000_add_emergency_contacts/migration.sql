CREATE TABLE "MsEmergencyContact" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "relation" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "MsEmergencyContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MsEmergencyContact_userId_isPrimary_idx" ON "MsEmergencyContact"("userId", "isPrimary");

ALTER TABLE "MsEmergencyContact" ADD CONSTRAINT "MsEmergencyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MsUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
