import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { normalizeEmail } from '../src/shared/text/normalize-email.js';
import { Argon2PasswordHasher } from '../src/modules/auth/infrastructure/argon2-password-hasher.js';

export interface SeedAdministrativeUserConfig {
  email: string;
  password: string;
  connectionString: string;
}

export async function seedAdministrativeUser(
  config: SeedAdministrativeUserConfig,
): Promise<void> {
  const normalizedEmail = normalizeEmail(config.email);
  const passwordHash = await new Argon2PasswordHasher().hash(config.password);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.connectionString }),
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
