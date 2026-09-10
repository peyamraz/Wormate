// Production entry point (`npm start`, e.g. on Railway).
//
// Builds the frontend, then launches the arena server and forwards
// SIGTERM/SIGINT to it. npm itself does not forward termination signals to
// its child, so without this wrapper a platform restart (SIGTERM to the
// top-level process) would orphan the server and it could only be killed
// by SIGKILL. With the wrapper the server drains its connections and exits
// cleanly, and the wrapper exits with the server's own exit code.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const build = spawn('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
const buildCode = await new Promise(resolveCode => build.on('close', resolveCode));
if (buildCode !== 0) {
  console.error('Frontend build failed; the arena server was not started.');
  process.exit(buildCode);
}

const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: root, stdio: 'inherit' });
let shuttingDown = false;
const forward = signal => {
  if (shuttingDown) return;
  shuttingDown = true;
  server.kill(signal);
};
process.on('SIGTERM', () => forward('SIGTERM'));
process.on('SIGINT', () => forward('SIGINT'));
server.on('error', error => {
  console.error('Failed to start the Wormate arena server:', error);
  process.exit(1);
});
server.on('close', (exitCode, signal) => {
  process.exit(signal ? 143 : (exitCode ?? 1));
});
