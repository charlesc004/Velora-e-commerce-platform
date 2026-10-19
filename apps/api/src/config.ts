import { config as loadEnvironment } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

loadEnvironment({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/velora?replicaSet=rs0'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  ENABLE_MOCK_PAYMENTS: z.enum(['true', 'false']).optional(),
  RESERVATION_MINUTES: z.coerce.number().int().min(1).max(120).default(20),
});
const parsed = schema.parse(process.env);
if (parsed.NODE_ENV === 'production' && !parsed.JWT_SECRET)
  throw new Error('JWT_SECRET (at least 32 characters) is required in production');
if (parsed.STRIPE_SECRET_KEY && !parsed.STRIPE_SECRET_KEY.startsWith('sk_test_'))
  throw new Error('VELORA supports Stripe test keys only');
export const config = {
  ...parsed,
  JWT_SECRET: parsed.JWT_SECRET ?? randomBytes(48).toString('hex'),
  mockPayments:
    parsed.ENABLE_MOCK_PAYMENTS === 'true' ||
    (parsed.NODE_ENV !== 'production' && parsed.ENABLE_MOCK_PAYMENTS !== 'false'),
  secureCookies: parsed.NODE_ENV === 'production',
};
