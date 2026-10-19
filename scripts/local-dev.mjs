import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import 'dotenv/config';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testMode = process.argv.includes('--test');
const apiOnly = process.argv.includes('--api-only');
const databasePort = testMode ? 27019 : Number(process.env.LOCAL_MONGO_PORT ?? 27018);
const databasePath = resolve(root, '.local', 'mongo');
const children = new Set();
let replicaSet;
let stopping = false;

async function ensurePortAvailable(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(
        new Error(
          `Port ${port} is already in use. Stop the existing process before starting VELORA.`,
        ),
      ),
    );
    server.listen(port, '127.0.0.1', () => server.close(resolvePort));
  });
}

function runNode(args, environment) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    windowsHide: true,
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function waitForExit(child) {
  return new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      code === 0 ? resolveExit() : reject(new Error(`Process exited with ${signal ?? code}`)),
    );
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit));
  if (process.platform === 'win32') {
    // Node's watch process has its own server child; terminate only the tree we started.
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await new Promise((resolveExit) => {
      killer.once('exit', resolveExit);
      killer.once('error', resolveExit);
    });
  } else child.kill('SIGTERM');
  await Promise.race([exited, new Promise((resolveExit) => setTimeout(resolveExit, 3000))]);
}

async function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([...children].map(stopChild));
  if (replicaSet) await replicaSet.stop({ doCleanup: testMode, force: false });
  process.exit(exitCode);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

try {
  await Promise.all(
    [databasePort, Number(process.env.PORT ?? '4000'), ...(apiOnly ? [] : [5173])].map(
      ensurePortAvailable,
    ),
  );
  if (!testMode) await mkdir(databasePath, { recursive: true });
  process.stdout.write(
    `\nVELORA · starting ${testMode ? 'isolated test' : 'persistent local'} MongoDB replica set…\n`,
  );
  replicaSet = await MongoMemoryReplSet.create({
    instanceOpts: [{ port: databasePort, ...(testMode ? {} : { dbPath: databasePath }) }],
    replSet: {
      count: 1,
      name: testMode ? 'velora-e2e' : 'velora-local',
      storageEngine: 'wiredTiger',
    },
  });
  const environment = {
    ...process.env,
    NODE_ENV: testMode ? 'test' : 'development',
    MONGODB_URI: replicaSet.getUri(testMode ? 'velora_e2e' : 'velora'),
    WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    PORT: process.env.PORT ?? '4000',
    JWT_SECRET: process.env.JWT_SECRET || randomBytes(48).toString('hex'),
    ENABLE_MOCK_PAYMENTS: process.env.ENABLE_MOCK_PAYMENTS ?? 'true',
    VELORA_SEED_FORCE: testMode ? 'true' : 'false',
  };
  await waitForExit(runNode(['--import', 'tsx', 'scripts/seed-local.mjs'], environment));
  process.stdout.write(
    `\nStorefront: ${environment.WEB_ORIGIN}${apiOnly ? ' (existing server)' : ''}\nAPI: http://localhost:${environment.PORT}/api/v1\n${testMode ? 'Test data is discarded when this process stops.' : `Database persists in ${databasePath}.`}\nPress Ctrl+C to stop.\n\n`,
  );
  const api = runNode(
    ['--import', 'tsx', ...(testMode ? [] : ['--watch']), 'apps/api/src/server.ts'],
    environment,
  );
  const services = [api];
  if (!apiOnly) {
    // Vite reads its configuration relative to the web workspace.
    const webServer = spawn(
      process.execPath,
      [
        resolve(root, 'node_modules/vite/bin/vite.js'),
        '--host',
        '127.0.0.1',
        '--port',
        '5173',
        '--strictPort',
      ],
      { cwd: resolve(root, 'apps/web'), env: environment, stdio: 'inherit', windowsHide: true },
    );
    children.add(webServer);
    webServer.once('exit', () => children.delete(webServer));
    services.push(webServer);
  }
  for (const child of services)
    child.once('exit', (code) => {
      if (!stopping) void shutdown(code ?? 1);
    });
} catch (error) {
  process.stderr.write(
    `\nUnable to start VELORA: ${error instanceof Error ? error.message : String(error)}\nThe first launch downloads a MongoDB binary. Check your network and port availability.\n`,
  );
  await shutdown(1);
}
