CREATE TYPE "HomeMemberRole" AS ENUM ('home_owner', 'administrator', 'common_member');
CREATE TYPE "HomeInvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE "Home" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationLabel" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Home_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeMember" (
    "id" TEXT NOT NULL,
    "role" "HomeMemberRole" NOT NULL DEFAULT 'common_member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "homeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "HomeMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomeInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "role" "HomeMemberRole" NOT NULL DEFAULT 'common_member',
    "status" "HomeInvitationStatus" NOT NULL DEFAULT 'pending',
    "inviteCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "homeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "HomeInvitation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RoomCategory" ADD COLUMN "homeId" TEXT;

DROP INDEX IF EXISTS "RoomCategory_name_key";
DROP INDEX IF EXISTS "RoomCategory_slug_key";

CREATE UNIQUE INDEX "HomeMember_homeId_userId_key" ON "HomeMember"("homeId", "userId");
CREATE INDEX "HomeMember_userId_idx" ON "HomeMember"("userId");
CREATE UNIQUE INDEX "HomeInvitation_inviteCode_key" ON "HomeInvitation"("inviteCode");
CREATE INDEX "HomeInvitation_homeId_status_idx" ON "HomeInvitation"("homeId", "status");
CREATE INDEX "HomeInvitation_email_idx" ON "HomeInvitation"("email");
CREATE INDEX "RoomCategory_homeId_idx" ON "RoomCategory"("homeId");
CREATE UNIQUE INDEX "RoomCategory_homeId_slug_key" ON "RoomCategory"("homeId", "slug");

ALTER TABLE "HomeMember"
ADD CONSTRAINT "HomeMember_homeId_fkey"
FOREIGN KEY ("homeId") REFERENCES "Home"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeMember"
ADD CONSTRAINT "HomeMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeInvitation"
ADD CONSTRAINT "HomeInvitation_homeId_fkey"
FOREIGN KEY ("homeId") REFERENCES "Home"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeInvitation"
ADD CONSTRAINT "HomeInvitation_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomCategory"
ADD CONSTRAINT "RoomCategory_homeId_fkey"
FOREIGN KEY ("homeId") REFERENCES "Home"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
