ALTER TABLE "Device"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "roomCategoryId" TEXT;

CREATE INDEX "Device_sortOrder_idx" ON "Device"("sortOrder");
CREATE INDEX "Device_roomCategoryId_idx" ON "Device"("roomCategoryId");

ALTER TABLE "Device"
ADD CONSTRAINT "Device_roomCategoryId_fkey"
FOREIGN KEY ("roomCategoryId") REFERENCES "RoomCategory"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
