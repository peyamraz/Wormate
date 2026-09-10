import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArenaServer } from './arenaServer';
import { allowedOrigins } from './security';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const host = process.env.HOST ?? '0.0.0.0';
const defaults = `http://localhost:${port},http://127.0.0.1:${port},http://localhost:5173,http://127.0.0.1:5173`;
const origins = allowedOrigins(process.env.ALLOWED_ORIGINS ?? (production ? '' : defaults), production);
const server = createArenaServer({
  origins, production,
  indexPath: resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist/index.html'),
  trustedProxies: new Set((process.env.TRUSTED_PROXY_IPS ?? '').split(',').map(value => value.trim()).filter(Boolean)),
});

try {
  await server.listen(port, host);
  console.info(`Listening on ${host}:${port}`);
  console.info('Wormate arena ready. IDs are kept in memory only.');
} catch (error) {
  console.error(`Failed to start Wormate arena on ${host}:${port}:`, error);
  process.exit(1);
}
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await server.close();
  process.exit(0);
};
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });