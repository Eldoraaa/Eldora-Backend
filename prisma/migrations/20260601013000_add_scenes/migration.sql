CREATE TYPE "SceneTriggerType" AS ENUM (
    'tap_to_run',
    'device_status_changes',
    'schedule',
    'weather_changes',
    'family_member_going_home'
);

CREATE TABLE "MsScene" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "SceneTriggerType" NOT NULL,
    "triggerConfig" JSONB,
    "actions" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "homeId" TEXT NOT NULL,
    "roomCategoryId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "MsScene_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MsScene_homeId_triggerType_sortOrder_idx" ON "MsScene"("homeId", "triggerType", "sortOrder");
CREATE INDEX "MsScene_roomCategoryId_idx" ON "MsScene"("roomCategoryId");

ALTER TABLE "MsScene" ADD CONSTRAINT "MsScene_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "MsHome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MsScene" ADD CONSTRAINT "MsScene_roomCategoryId_fkey" FOREIGN KEY ("roomCategoryId") REFERENCES "MsRoomCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MsScene" ADD CONSTRAINT "MsScene_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "MsUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
