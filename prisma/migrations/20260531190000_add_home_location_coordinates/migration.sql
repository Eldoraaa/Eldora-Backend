ALTER TABLE "Home"
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

UPDATE "Home"
SET
  "locationLabel" = COALESCE("locationLabel", 'Tangerang Kelapa Dua'),
  "address" = COALESCE("address", 'Jl. Faraday Selatan 7 No.5, Medang, Kec. Pagedangan, Kabupaten Tangerang, Banten 15339, Indonesia'),
  "latitude" = COALESCE("latitude", -6.2569),
  "longitude" = COALESCE("longitude", 106.6184);
