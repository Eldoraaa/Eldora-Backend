DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'MsDevice_roomCategoryId_fkey'
      AND table_name = 'MsDevice'
  ) THEN
    ALTER TABLE "MsDevice" DROP CONSTRAINT "MsDevice_roomCategoryId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Device_roomCategoryId_fkey'
      AND table_name = 'MsDevice'
  ) THEN
    ALTER TABLE "MsDevice" DROP CONSTRAINT "Device_roomCategoryId_fkey";
  END IF;
END $$;

ALTER TABLE "MsDevice"
ADD CONSTRAINT "MsDevice_roomCategoryId_fkey"
FOREIGN KEY ("roomCategoryId") REFERENCES "MsRoomCategory"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
