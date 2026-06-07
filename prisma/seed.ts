import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  // Presets are copied into a household during onboarding. The seed remains
  // intentionally empty so a deployment never creates shared financial rows.
  await prisma.$queryRaw`SELECT 1`;
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
