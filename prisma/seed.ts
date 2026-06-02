import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { config } from "../src/config/env";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.databaseUrl }),
});

const roomCategories = [
  { name: "Living Room", slug: "living-room", sortOrder: 10 },
  { name: "Dining Room", slug: "dining-room", sortOrder: 20 },
  { name: "Bedroom", slug: "bedroom", sortOrder: 30 },
  { name: "Bathroom", slug: "bathroom", sortOrder: 40 },
  { name: "Kitchen", slug: "kitchen", sortOrder: 50 },
  { name: "Garage", slug: "garage", sortOrder: 60 },
  { name: "Outdoor", slug: "outdoor", sortOrder: 70 },
  { name: "Care Room", slug: "care-room", sortOrder: 80 },
];

async function main() {
  await prisma.msRoomCategory.deleteMany({ where: { slug: "all", homeId: null } });

  for (const room of roomCategories) {
    const existingRoom = await prisma.msRoomCategory.findFirst({
      where: { slug: room.slug, homeId: null },
    });

    if (existingRoom) {
      await prisma.msRoomCategory.update({
        where: { id: existingRoom.id },
        data: {
          name: room.name,
          sortOrder: room.sortOrder,
          isDefault: true,
        },
      });
      continue;
    }

    await prisma.msRoomCategory.create({
      data: {
        ...room,
        isDefault: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
