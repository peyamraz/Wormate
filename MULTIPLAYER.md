# Wormate Live Arena

The project now includes an actual Node/WebSocket arena, not a simulated online
counter. A static Vite preview cannot run the Node process. Online testing is not
complete until this server is running and reachable by both devices.

## Local Test

Requires Node 22 LTS (22.12 or newer) and npm. From the project root:

```sh
npm install
npm run build
node --import tsx server/index.ts
```

Open `http://localhost:3001` in two tabs or separate browsers. Choose **Live
Arena**, enter different nicknames, and join the same room, for example `SWEET`.
Use **Invite a friend** to copy a link containing the room code, never an ID or
credential. The upper-right counter distinguishes connected human sessions,
living players, and AI bots. Rooms are public test rooms, not password-protected.

The Vite development frontend on port 5173 connects to port 3001 on localhost.
It can also use the explicit server field, or `VITE_ARENA_URL` when building a
separately hosted frontend. The backend must allow that frontend's exact origin.

## Two Devices On A LAN

Find the host computer's LAN IP; replace the example below with your actual IP.
Allow inbound TCP 3001 through the local firewall only on a trusted network.

```sh
HOST=0.0.0.0 ALLOWED_ORIGINS=http://192.168.1.50:3001 node --import tsx server/index.ts
```

Open `http://192.168.1.50:3001` on both devices. Do not use `localhost` on the
second device. On Windows, put the values in `.env` using `.env.example` as a
starting point and run `node --env-file=.env --import tsx server/index.ts`.
Plain HTTP/WS is for trusted LAN testing only.

## Public Deployment

Use one Node process with an HTTPS/WSS reverse proxy, such as Caddy. Do not
publish the Vite development server. Example production environment:

```text
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
ALLOWED_ORIGINS=https://game.example.com
```

Point the domain to your server and replace `game.example.com` in
`deploy/Caddyfile`. Caddy terminates TLS and forwards WebSocket upgrades to the
Node service, which also serves `dist/index.html`. Rebuild and restart after
frontend changes because the server computes CSP hashes for the built scripts.

By default, forwarded client IP headers are ignored. If deploying behind a
proxy, restrict direct backend access with a firewall, make the proxy overwrite
`X-Forwarded-For`, then set `TRUSTED_PROXY_IPS` to the proxy's actual socket IP
(for a local proxy, typically `127.0.0.1,::1`). Never trust arbitrary forwarded
headers. Add connection and bandwidth limits at the proxy/network edge too.

### Railway

`npm start` is the production entry point: it builds the frontend into `dist/`
and then boots the arena server, so the single Railway service serves both the
game page and the WebSocket endpoint. Set these variables on Railway:

```text
NODE_ENV=production
ALLOWED_ORIGINS=https://wormate-gold.vercel.app
```

Railway injects `PORT`; the server binds `0.0.0.0` by default and logs
`Listening on 0.0.0.0:<port>` once it is ready.

`npm start` runs `server/start.js`, which launches the arena as a child
process and forwards `SIGTERM`/`SIGINT` to it (npm does not forward
termination signals on its own). The server then drains open connections and
exits cleanly, so Railway restarts and deploys do not crash the service.

## Identity Lifetime

- The server creates a cryptographically random UUID after a validated join.
- The socket owns its session. Clients cannot submit an ID to control someone else.
- ID, nickname, input and room membership live only in process/browser memory.
- Opening the menu, losing focus, dying, or respawning does not change the ID.
- Explicit leave deletes the session immediately; `pagehide` sends best-effort leave.
- Socket close/error deletes the session. A crashed or unreachable client is
  removed after a missing heartbeat, normally within 20-30 seconds.
- An operating system kill cannot guarantee immediate delivery of a browser
  leave event; the server heartbeat is the cleanup authority.
- Refreshing or rejoining creates a new identity. There is no reconnect token,
  persistent account, recovery across refresh, or tracking cookie.
- Empty rooms are destroyed. Restarting the server deletes all live sessions.
- Browser-local high scores remain intentionally, without player IDs. They are
  not authoritative online records and are never uploaded to the server.

## Security Boundaries

The server runs movement, turn limits, boosts, food, bonuses, collisions, scores,
respawns and ranking at a fixed 60 Hz. The browser submits only a validated
angle, boost boolean and increasing sequence number; its frame rate cannot
accelerate the authoritative world. Only dead players may respawn. Online play
does not pause when a player opens a menu, and stale input stops boosting.

The WebSocket endpoint has an exact origin allowlist, strict message shapes,
nickname/room limits, a 1 KB inbound payload cap, disabled compression, per-IP
connection/upgrade limits, a per-socket message budget, a join deadline,
heartbeat expiry, and bounded outgoing buffering. Four rooms with at most 16
human sessions each are supported per process. Six bots populate each live room.
Snapshot interest filtering sends nearby scenery rather than the entire world.

The HTTP server only exposes the built page and `/health`, never arbitrary files
or session listings. It supplies CSP hashes for inline application scripts,
anti-framing, MIME-sniffing, referrer and permissions headers. Inline styles
remain allowed for React/canvas theme colors. IDs are not secrets or account
authentication. Origin checks protect browser cross-site access; they are not a
substitute for login or protection against malicious native clients.

This is a hardened guest-play test server, not a guarantee of vulnerability-free
production operation. It has no account authentication, distributed room store,
cross-process reconnect, DDoS service, or independent penetration-test result.
Keep one process for the same room; replicas otherwise have separate worlds.
Do not put private data into room codes or nicknames.

## Verification

```sh
npx tsc --noEmit
node --import tsx --test server/protocol.test.ts server/engine.test.ts server/multiplayer.test.ts
npm audit
```

The test files cover session uniqueness/deletion, two real WebSocket clients,
room isolation, origin rejection, payload/rate limits, shared scoring,
simultaneous collisions, bonus expiry, and rejection of forged score/ID fields.
These tests still need to be executed on the runtime host; a Vite build alone is
not evidence that WebSocket behavior, security, or device performance is verified.
The last dependency installation report showed one remaining **low-severity**
advisory after updating Vite and the build plugins. Run `npm audit` on the host
to identify and resolve that remaining item before opening a public service.
The initial high-severity dependency warning no longer appeared after the update.

Manual acceptance checks:

1. Two browsers in the same room see each other and a connected count of two.
2. Moving/eating in one browser changes its score on the other browser.
3. Pause/menu and game over retain the same ID; respawn retains it but resets score.
4. Leave or close a tab and observe the count drop; rejoin with a different ID.
5. Drop a device's network and confirm eventual heartbeat cleanup.
6. Test keyboard, touch steering, boost release, rotation and long sessions on
   real devices; measure frame rate and bandwidth under the expected load.