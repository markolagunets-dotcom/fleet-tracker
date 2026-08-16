-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "droneId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "distanceM" REAL NOT NULL,
    "maxAltM" REAL NOT NULL,
    "endedReason" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TrackPoint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "flightId" TEXT NOT NULL,
    "ts" DATETIME NOT NULL,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "alt" REAL NOT NULL,
    "battery" REAL NOT NULL,
    CONSTRAINT "TrackPoint_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Flight_droneId_endedAt_idx" ON "Flight"("droneId", "endedAt");

-- CreateIndex
CREATE INDEX "TrackPoint_flightId_ts_idx" ON "TrackPoint"("flightId", "ts");
