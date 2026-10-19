import { app } from './app.js';
import { config } from './config.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { initializeIndexes } from './models.js';
import { expireReservations } from './modules/commerce.js';

await connectDatabase();
await initializeIndexes();
await expireReservations();
const server = app.listen(config.PORT, () =>
  console.info(`VELORA API listening on http://localhost:${config.PORT}`),
);
const timer = setInterval(() => {
  void expireReservations().catch(() =>
    console.error('Inventory expiration sweep failed; it will retry.'),
  );
}, 30000);
timer.unref();
let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(timer);
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(() => {
    void disconnectDatabase().then(() => {
      clearTimeout(timeout);
      process.exit(0);
    });
  });
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
