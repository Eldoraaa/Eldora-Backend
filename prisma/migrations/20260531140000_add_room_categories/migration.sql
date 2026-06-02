CREATE TABLE "RoomCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomCategory_name_key" ON "RoomCategory"("name");
CREATE UNIQUE INDEX "RoomCategory_slug_key" ON "RoomCategory"("slug");
CREATE INDEX "RoomCategory_sortOrder_idx" ON "RoomCategory"("sortOrder");
