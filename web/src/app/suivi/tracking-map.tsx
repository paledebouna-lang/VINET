"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export type MapPoint = {
  latitude: number;
  longitude: number;
  // The source of a position is never mixed up with another: each has its own shape and label.
  kind: "live" | "last" | "observation";
  label: string;
};
type Zone = { latitude: number; longitude: number; radiusKm: number };

/** A map of positions. Each marker says in words what it is; the shapes repeat it for the eye. */
export function TrackingMap({ points, path = [], zone }: { points: MapPoint[]; path?: [number, number][]; zone?: Zone }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    // Leaflet touches `window` when loaded, so it is imported in the browser only.
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      if (zone) {
        const center = L.latLng(zone.latitude, zone.longitude);
        L.circle(center, {
          radius: zone.radiusKm * 1000,
          color: "#2446e8",
          weight: 2,
          dashArray: "6 6",
          fillOpacity: 0.05,
        }).addTo(map);
        // circle.getBounds() needs a map that already has a view; this one has none yet.
        bounds.extend(center.toBounds(zone.radiusKm * 2000));
      }
      if (path.length > 1) L.polyline(path, { color: "#56607f", weight: 3, opacity: 0.7 }).addTo(map);
      for (const p of points) {
        const marker = L.marker([p.latitude, p.longitude], {
          icon: L.divIcon({ className: `map-marker map-marker-${p.kind}`, iconSize: [22, 22] }),
          title: p.label,
          alt: p.label,
        }).addTo(map);
        marker.bindTooltip(p.label, { permanent: points.length <= 4, direction: "top", offset: [0, -12] });
        bounds.extend([p.latitude, p.longitude]);
      }
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.3), { maxZoom: 16 });
      else map.setView([5.345, -4.024], 11); // Abidjan
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, path, zone]);

  return <div ref={container} className="map" role="region" aria-label="Carte des positions" />;
}

export function MapLegend({ zone = false, path = false }: { zone?: boolean; path?: boolean }) {
  return (
    <ul className="map-legend">
      <li>
        <span className="map-marker map-marker-live" aria-hidden="true" /> En direct · GPS
      </li>
      <li>
        <span className="map-marker map-marker-last" aria-hidden="true" /> Dernière position · GPS
      </li>
      <li>
        <span className="map-marker map-marker-observation" aria-hidden="true" /> Observation · QR
      </li>
      {path && (
        <li>
          <span className="legend-path" aria-hidden="true" /> Trajet récent
        </li>
      )}
      {zone && (
        <li>
          <span className="legend-zone" aria-hidden="true" /> Zone autorisée
        </li>
      )}
    </ul>
  );
}
