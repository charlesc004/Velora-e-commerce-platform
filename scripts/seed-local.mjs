import { connectDatabase, disconnectDatabase } from '../apps/api/src/db.ts';
import { seedDatabase } from '../apps/api/src/seed.ts';

try {
  await connectDatabase(process.env.MONGODB_URI);
  await seedDatabase({ force: process.env.VELORA_SEED_FORCE === 'true' });
} finally {
  await disconnectDatabase();
}
