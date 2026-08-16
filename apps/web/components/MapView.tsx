'use client';

import type { FlightDetailDto, Mission, Telemetry, TrackHistory } from '@fleet-tracker/shared';
import { TRACK_POINT_LIMIT } from '@fleet-tracker/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface MapHandle {
  /** Called at 5 Hz from the socket. Deliberately outside React's render cycle. */
  pushPoints(points: Telemetry[]): void;
  showFlight(flight: FlightDetailDto | null): void;
}

interface MapViewProps {
  missions: Mission[];
  history: TrackHistory | undefined;
  selectedDroneId: string;
  follow: boolean;
  onSelect(droneId: string): void;
}

interface DroneLayers {
  marker: L.Marker;
  track: L.Polyline;
}

const KYIV: L.LatLngExpression = [50.45, 30.523];

function arrowIcon(colour: string, heading: number, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<svg width="28" height="28" viewBox="0 0 28 28" style="transform: rotate(${heading}deg)">
             <circle cx="14" cy="14" r="12" fill="${colour}" fill-opacity="${selected ? 0.35 : 0.15}"/>
             <path d="M14 3 L21 24 L14 19 L7 24 Z" fill="${colour}" stroke="#0f172a" stroke-width="1"/>
           </svg>`,
  });
}

export const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(
  { missions, history, selectedDroneId, follow, onSelect },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Map<string, DroneLayers>>(new Map());
  const flightLayerRef = useRef<L.Polyline | null>(null);

  // Read inside pushPoints without re-subscribing the socket.
  const selectedRef = useRef(selectedDroneId);
  selectedRef.current = selectedDroneId;
  const followRef = useRef(follow);
  followRef.current = follow;
  const missionsRef = useRef(missions);
  missionsRef.current = missions;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) {
      return;
    }

    const map = L.map(containerRef.current, { center: KYIV, zoom: 12, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    // Captured now: by cleanup time the ref may point somewhere else.
    const layers = layersRef.current;

    return () => {
      map.remove();
      mapRef.current = null;
      layers.clear();
    };
  }, []);

  // Planned routes, drawn once per mission set.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || missions.length === 0) {
      return;
    }

    const routes = missions.map((mission) =>
      L.polyline(
        [...mission.waypoints, mission.waypoints[0]!].map((wp) => [wp.lat, wp.lon] as L.LatLngTuple),
        { color: mission.colour, weight: 1.5, opacity: 0.5, dashArray: '6 8' },
      ).addTo(map),
    );

    return () => {
      routes.forEach((route) => route.remove());
    };
  }, [missions]);

  // Seed the flown track from REST, then let the socket extend it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !history || missions.length === 0) {
      return;
    }

    for (const mission of missions) {
      const points = history[mission.droneId] ?? [];
      const latLngs = points.map((point) => [point.lat, point.lon] as L.LatLngTuple);
      const last = points[points.length - 1];
      const existing = layersRef.current.get(mission.droneId);

      if (existing) {
        existing.track.setLatLngs(latLngs);
        continue;
      }

      const track = L.polyline(latLngs, { color: mission.colour, weight: 3 }).addTo(map);
      const marker = L.marker(
        last ? [last.lat, last.lon] : [mission.waypoints[0]!.lat, mission.waypoints[0]!.lon],
        { icon: arrowIcon(mission.colour, last?.heading ?? 0, mission.droneId === selectedDroneId) },
      )
        .addTo(map)
        .on('click', () => onSelect(mission.droneId));

      layersRef.current.set(mission.droneId, { marker, track });
    }
  }, [history, missions, onSelect, selectedDroneId]);

  useImperativeHandle(
    ref,
    () => ({
      pushPoints(points: Telemetry[]): void {
        const map = mapRef.current;
        if (!map) {
          return;
        }

        for (const point of points) {
          const layers = layersRef.current.get(point.droneId);
          if (!layers) {
            continue;
          }

          const position: L.LatLngTuple = [point.lat, point.lon];
          layers.marker.setLatLng(position);

          const colour =
            missionsRef.current.find((mission) => mission.droneId === point.droneId)?.colour ??
            '#94a3b8';
          layers.marker.setIcon(
            arrowIcon(colour, point.heading, point.droneId === selectedRef.current),
          );

          layers.track.addLatLng(position);
          const line = layers.track.getLatLngs() as L.LatLng[];
          if (line.length > TRACK_POINT_LIMIT) {
            layers.track.setLatLngs(line.slice(line.length - TRACK_POINT_LIMIT));
          }

          if (followRef.current && point.droneId === selectedRef.current) {
            map.panTo(position, { animate: false });
          }
        }
      },

      showFlight(flight: FlightDetailDto | null): void {
        const map = mapRef.current;
        if (!map) {
          return;
        }

        flightLayerRef.current?.remove();
        flightLayerRef.current = null;

        if (!flight || flight.points.length === 0) {
          return;
        }

        const latLngs = flight.points.map((point) => [point.lat, point.lon] as L.LatLngTuple);
        flightLayerRef.current = L.polyline(latLngs, {
          color: '#ffffff',
          weight: 4,
          opacity: 0.9,
        }).addTo(map);
        map.fitBounds(flightLayerRef.current.getBounds(), { padding: [40, 40] });
      },
    }),
    [],
  );

  return <div ref={containerRef} className="h-full w-full" />;
});
