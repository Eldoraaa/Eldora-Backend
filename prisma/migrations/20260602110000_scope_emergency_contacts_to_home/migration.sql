ALTER TABLE "MsEmergencyContact" ADD COLUMN "homeId" TEXT;
CREATE INDEX "MsEmergencyContact_homeId_isPrimary_idx" ON "MsEmergencyContact"("homeId", "isPrimary");
ALTER TABLE "MsEmergencyContact" ADD CONSTRAINT "MsEmergencyContact_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "MsHome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
