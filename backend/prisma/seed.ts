import 'dotenv/config';
import { seedAdministrativeUser } from './seed-administrative-user.js';

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const connectionString = process.env.DATABASE_URL;

  if (!email || !password || !connectionString) {
    throw new Error(
      'ADMIN_EMAIL, ADMIN_PASSWORD and DATABASE_URL must be set to run the seed',
    );
  }

  await seedAdministrativeUser({ email, password, connectionString });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
