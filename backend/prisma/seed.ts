import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { normalizeEmail } from '../src/modules/auth/application/normalize-email.js';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';

async function seed(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const connectionString = process.env.DATABASE_URL;

  if (!email || !password || !connectionString) {
    throw new Error(
      'ADMIN_EMAIL, ADMIN_PASSWORD and DATABASE_URL must be set to run the seed',
    );
  }

  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await new Argon2PasswordHasher().hash(password);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: { email: normalizedEmail, passwordHash },
    });

    console.log(`Administrative user ready: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
