-- CreateTable
CREATE TABLE "beacon" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "sealedKey" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "rotationExponent" INTEGER NOT NULL,
    "clockOffset" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3),

    CONSTRAINT "beacon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "detector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection" (
    "id" TEXT NOT NULL,
    "beaconId" TEXT NOT NULL,
    "detectorId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" INTEGER,
    "rssi" INTEGER,

    CONSTRAINT "detection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beacon_vehicleId_key" ON "beacon"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "beacon_keyHash_key" ON "beacon"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "detector_keyHash_key" ON "detector"("keyHash");

-- CreateIndex
CREATE INDEX "detection_detectedAt_idx" ON "detection"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "detection_beaconId_detectorId_detectedAt_key" ON "detection"("beaconId", "detectorId", "detectedAt");

-- AddForeignKey
ALTER TABLE "beacon" ADD CONSTRAINT "beacon_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection" ADD CONSTRAINT "detection_beaconId_fkey" FOREIGN KEY ("beaconId") REFERENCES "beacon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detection" ADD CONSTRAINT "detection_detectorId_fkey" FOREIGN KEY ("detectorId") REFERENCES "detector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

