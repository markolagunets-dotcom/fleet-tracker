# PatMap — Design Document

**Date:** 2026-08-16
**Status:** Approved, ready for implementation

A real-time drone fleet tracking dashboard. A simulated fleet of three drones flies
predefined missions; telemetry is streamed to the browser over WebSocket and rendered
as live tracks on a Leaflet map, alongside a status panel and a persisted flight log.

This is a portfolio project. Beyond working software, it is meant to demonstrate a
defensible split between REST and WebSocket transports, disciplined React rendering
under a high-frequency data stream, and a typed contract shared across the stack.

---

## 1. Goals and non-goals

### Goals

- Stream synthetic telemetry (position, altitude, battery, speed, heading, status) for
  three drones at 5 Hz.
- Render live tracks and the current position of each drone on a Leaflet map.
- Show a status panel for the selected drone and let the operator issue commands.
- Persist completed flights and expose them through a REST API.
- Ship with a README, CI, and Docker so the project can be run and reviewed in minutes.

### Non-goals

- Real MAVLink / hardware integration. Telemetry is synthetic by design.
- Authentication and multi-tenancy. There is a single implicit operator.
- Horizontal scaling. Simulation state lives in one process; there is no Redis or
  message broker. Documented as a known limitation rather than hidden.
- Mobile-first layout. The target is a desktop operator console.

---

## 2. Architecture

```
                       apps/server (NestJS 11)
   ┌──────────────────────────────────────────────────────────┐
   │  FleetService ── 3 × SimulatorService  (5 Hz tick loop)   │
   │        │                                                 │
   │        ├──► TelemetryGateway ──── WebSocket ──────────────┼──►  live deltas
   │        │                                                  │
   │        └──► FlightsRepository ──► Prisma ──► SQLite       │
   │                    │                                      │
   │      TelemetryController · FlightsController · Missions ──┼──►  REST (initial state)
   └──────────────────────────────────────────────────────────┘
                              │
                packages/shared — Telemetry, ServerMessage, constants
                              │
                       apps/web (Next 16)
   ┌──────────────────────────────────────────────────────────┐
   │  React Query ──► missions, track history, flight log      │
   │  useTelemetryStream ──► ref ──► Leaflet imperative API    │
   │                     └──► throttled setQueryData ──► panel │
   └──────────────────────────────────────────────────────────┘
```

### Transport split

REST serves **initial state**; WebSocket streams **deltas**. A client that connects
fetches the planned mission and the track so far over HTTP, then subscribes to the
socket for subsequent points. The socket carries no snapshot payload.

This is the central design decision of the project. The alternative — sending a
`history` frame on connect — collapses both concerns into the socket, which makes the
snapshot uncacheable, untestable with `supertest`, and invisible to anything that
speaks HTTP. Splitting them keeps each transport doing what it is good at.

---

## 3. Shared contract (`packages/shared`)

A single workspace package is the source of truth for anything crossing the wire.
Next consumes it via `transpilePackages`; Nest via tsconfig path mapping. Changing a
field on the server breaks the web typecheck, and CI catches it.

```ts
export type DroneStatus = 'FLYING' | 'RTB' | 'LANDED' | 'PAUSED';

export interface Telemetry {
  droneId: string;
  ts: number;        // epoch ms
  lat: number;
  lon: number;
  alt: number;       // metres AGL
  battery: number;   // 0..100
  speed: number;     // m/s
  heading: number;   // degrees, 0 = north
  status: DroneStatus;
}

export type ServerMessage =
  | { type: 'tick'; points: Telemetry[] }        // one entry per active drone
  | { type: 'flightEnded'; droneId: string; flightId: string };
```

`TICK_HZ`, `PANEL_HZ`, `TRACK_POINT_LIMIT`, `LOW_BATTERY_THRESHOLD` and the mission
definitions also live here, so client and server cannot disagree about them.

### Batching

One `tick` frame carries the points for all three drones. At 5 Hz that is 5 frames per
second rather than 15, and it guarantees the client renders a coherent fleet state
rather than three interleaved partial updates.

---

## 4. Backend (`apps/server`)

### Simulation

`SimulatorService` owns one drone. It is a plain injectable with a single
`tick(dtMs): Telemetry` method and no knowledge of WebSockets, HTTP, or persistence —
which is what makes the flight model unit-testable in isolation.

Flight model:

- The drone flies a closed loop of waypoints at ~15 m/s.
- `heading` is the great-circle bearing to the next waypoint; on arrival within a
  threshold radius it advances to the following one, wrapping at the end.
- Altitude oscillates between 80 m and 140 m on a slow sine.
- Battery drains at roughly 1% per 30 s of flight.
- Below `LOW_BATTERY_THRESHOLD` (15%) the status becomes `RTB` and the drone heads for
  the first waypoint. At 0% it becomes `LANDED`.

`FleetService` owns three `SimulatorService` instances with distinct missions and
drives them from a single `setInterval` at `TICK_HZ`. When a drone lands, the service
writes the completed flight through `FlightsRepository`, emits `flightEnded`, and
restarts that drone on a fresh battery.

Deriving heading and distance from real bearing math rather than a canned path is
deliberate: it is the part of the simulator worth testing, and the tests read as
meaningful assertions rather than snapshot comparisons.

### Persistence

Prisma 7 over SQLite. A file database keeps `docker compose up` to a single service
per app while still exercising a schema, migrations, and a repository layer.

```prisma
model Flight {
  id          String       @id @default(cuid())
  droneId     String
  startedAt   DateTime
  endedAt     DateTime
  distanceM   Float
  maxAltM     Float
  endedReason String       // "BATTERY_DEPLETED" | "OPERATOR_RESET"
  points      TrackPoint[]
}

model TrackPoint {
  id       Int      @id @default(autoincrement())
  flightId String
  flight   Flight   @relation(fields: [flightId], references: [id], onDelete: Cascade)
  ts       DateTime
  lat      Float
  lon      Float
  alt      Float
  battery  Float
  @@index([flightId, ts])
}
```

Track points are written once, in a batch, when the flight ends — not on every tick.
Writing 5 rows per second per drone would make SQLite the bottleneck of a system whose
entire point is that it is not I/O bound.

### REST API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/drones` | Fleet roster with current status |
| `GET` | `/api/missions` | Planned routes (waypoints), rendered as dashed polylines |
| `GET` | `/api/telemetry/history` | Track so far for the current flights |
| `GET` | `/api/flights` | Completed flight summaries |
| `GET` | `/api/flights/:id` | One flight with its full track |
| `POST` | `/api/drones/:id/command` | `PAUSE` \| `RESUME` \| `RTB` \| `RESET` |
| `GET` | `/api/health` | Liveness |

Documented with `@nestjs/swagger` at `/api/docs`. Request bodies are `class-validator`
DTOs behind a global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`, so
unknown fields are rejected rather than silently ignored.

### WebSocket gateway

`TelemetryGateway` uses `@nestjs/platform-ws` on the native `ws` adapter rather than
Socket.IO. The client needs no library at all — the browser's built-in `WebSocket` is
enough — the frames are readable in DevTools, and none of Socket.IO's features (rooms,
acks, long-polling fallback) are used here. Reconnection is roughly twenty lines of
client code, which is a fair trade for dropping a dependency and a protocol layer.

---

## 5. Frontend (`apps/web`)

Next 16 with the App Router. Turbopack is the default dev bundler in this version;
production builds run `next build --turbopack`.

### Component structure

- `app/layout.tsx` — shell and `Providers` (React Query client).
- `app/page.tsx` — server component composing the console layout.
- `components/MapView.tsx` — `'use client'`, loaded through
  `dynamic(..., { ssr: false })`. Leaflet touches `window` at import time and cannot be
  server-rendered.
- `components/StatusPanel.tsx` — altitude, battery, speed, heading, status, point
  count, and connection state for the selected drone.
- `components/FleetList.tsx` — the three drones; selection drives panel and follow.
- `components/FlightHistory.tsx` — completed flights; selecting one draws its track.
- `hooks/useTelemetryStream.ts` — connection, backoff, parsing, fan-out.

### Rendering strategy

The map is driven imperatively. The `L.Map`, per-drone `L.Marker` and `L.Polyline`
instances live in refs; each tick calls `marker.setLatLng()` and
`polyline.addLatLng()`. React does not re-render on telemetry.

React Query owns everything that is *not* the hot path: missions, initial track
history, the flight log. Live points are deliberately kept out of the cache. Pushing
5 Hz updates through `setQueryData` on the track array would re-render every subscriber
five times a second and copy a growing array on each one. Instead, only a throttled
"latest telemetry" value is written to the cache at `PANEL_HZ` (2 Hz) for the status
panel, which is the sole consumer that needs React to re-render.

Knowing where React Query belongs — and where it actively hurts — is the point of this
section, and it is called out in the README.

`flightEnded` frames trigger `invalidateQueries(['flights'])`, so the history list
refreshes without polling. Operator commands go through `useMutation` against
`POST /api/drones/:id/command`.

The drone marker is an `L.divIcon` wrapping an SVG arrow rotated by `heading`. An
auto-follow toggle calls `map.panTo` for the selected drone and is disabled as soon as
the user pans manually, so the map does not fight the operator.

### Connection handling

`NEXT_PUBLIC_WS_URL` and `NEXT_PUBLIC_API_URL` configure the endpoints, so promoting
the app from localhost to a deployment is an environment change rather than a code
change.

Reconnection uses exponential backoff from 1 s to 10 s. The UI shows `connected`,
`reconnecting`, or `offline`. On reconnect the track history query is refetched, so a
client that was away does not draw a gap as a straight line across the map.

---

## 6. Error handling and limits

- Malformed frames are logged and dropped; the socket stays open.
- Tracks are capped at `TRACK_POINT_LIMIT` (2000 points) on both ends. An unbounded
  polyline degrades the map and the browser.
- If the API is unreachable at load, the map still renders with the mission overlay
  missing and an error banner, rather than a blank page.
- Command endpoints are idempotent: `RESUME` on a flying drone is a no-op, not a 500.

---

## 7. Testing

- **Unit (Jest).** Bearing and distance math against known coordinate pairs; waypoint
  advance and wraparound; monotonic battery drain; `RTB` at 15%; `LANDED` at 0%;
  flight summary aggregation (distance, max altitude).
- **E2E (supertest).** Every REST endpoint: shape, status codes, validation rejection
  of unknown and malformed command payloads.
- **Contract.** A test asserting the serialised `ServerMessage` union matches the
  shared types, so the wire format cannot drift from the package silently.

The frontend is not unit tested. At this size the rendering path is faster and more
honestly verified in a browser, and the README says so rather than implying coverage
that does not exist.

---

## 8. Repository layout

```
patmap/
├── apps/
│   ├── server/
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── simulation/     SimulatorService, FleetService, geo utilities
│   │       ├── telemetry/      TelemetryGateway, TelemetryController
│   │       ├── flights/        FlightsController, FlightsRepository
│   │       └── missions/       MissionsController
│   └── web/
│       ├── app/                layout, page, providers
│       ├── components/         MapView, StatusPanel, FleetList, FlightHistory
│       ├── hooks/              useTelemetryStream, useMissions, useFlights
│       └── lib/                api client, ws client
├── packages/shared/            types, message contract, constants, missions
├── .github/workflows/ci.yml
├── docker-compose.yml
└── docs/design.md
```

npm workspaces with `concurrently`: `npm run dev` at the root starts both apps.

---

## 9. Delivery

- **README** with a demo GIF, a mermaid data-flow diagram, run instructions, and a
  "Design decisions" section covering the REST/WebSocket split, raw Leaflet over
  react-leaflet, native `ws` over Socket.IO, and the React Query hot-path boundary.
- **CI** (GitHub Actions): lint, `tsc --noEmit`, tests, and build on every push.
- **Docker**: a multi-stage Dockerfile per app and a `docker-compose.yml` that brings
  the whole stack up with one command.

### Deployment (deferred)

Not part of this iteration. The environment-variable indirection above is the only
thing needed to enable it later. Vercel cannot host the WebSocket server; the backend
would go to Koyeb's free tier or a Fly.io machine at roughly $2/month.

---

## 10. Known limitations

Stated in the README rather than papered over:

- Simulation state is in-process, so the server does not scale horizontally.
- SQLite suits a single-node demo; a real deployment would want Postgres and a
  time-series store for track points.
- There is no authentication.
