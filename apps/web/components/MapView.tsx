'use client';

import type { FlightDetailDto, Mission, Telemetry, TrackHistory } from '@fleet-tracker/shared';
import { TRACK_POINT_LIMIT, TRACK_TRIM_BLOCK } from '@fleet-tracker/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface MapHandle {
  /** Called at 5 Hz from the socket. Deliberately outside React's render cycle. */
  pushPoints(points: Telemetry[]): void;
  showFlight(flight: FlightDetailDto | null): void;
  /** Live point count. The REST seed goes stale within a second of connecting. */
  trackLength(droneId: string): number;
}

interface MapViewProps {
  missions: Mission[];
  history: TrackHistory | undefined;
  selectedDroneId: string;
  follow: boolean;
  onSelect(droneId: string): void;
  /** Called when the operator pans by hand, so follow mode can step aside. */
  onFollowDisengage(): void;
}

interface DroneLayers {
  marker: L.Marker;
  track: L.Polyline;
  colour: string;
  /** Cached so the per-frame path is one style write, with no DOM lookup. */
  svg: SVGElement | null;
  selected: boolean;
}

const KYIV: L.LatLngExpression = [50.45, 30.523];


/**
 * Built once per drone and then mutated in place.
 *
 * `marker.setIcon()` tears down and rebuilds the marker's DOM element, so calling
 * it per frame meant 15 element replacements a second. Rotation is a style write
 * on the existing SVG instead.
 */
function arrowIcon(colour: string, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<svg width="28" height="28" viewBox="0 0 28 28" style="will-change: transform">
             <circle cx="14" cy="14" r="12" fill="${colour}" fill-opacity="${selected ? 0.35 : 0.15}"/>
             <path d="M14 3 L21 24 L14 19 L7 24 Z" fill="${colour}" stroke="#0f172a" stroke-width="1"/>
           </svg>`,
  });
}

/** The <svg> inside a divIcon marker, cached so each frame is a single style write. */
function iconSvg(marker: L.Marker): SVGElement | null {
  return (marker.getElement()?.firstElementChild as SVGElement | null) ?? null;
}

export const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(
  { missions, history, selectedDroneId, follow, onSelect, onFollowDisengage },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Map<string, DroneLayers>>(new Map());
  const flightLayerRef = useRef<L.Polyline | null>(null);

  // Read inside pushPoints without re-subscribing the socket. Written in an
  // effect rather than during render, and declared before the effects that read
  // them so they are current by the time those run.
  const selectedRef = useRef(selectedDroneId);
  const followRef = useRef(follow);
  const onSelectRef = useRef(onSelect);
  const onFollowDisengageRef = useRef(onFollowDisengage);

  useEffect(() => {
    selectedRef.current = selectedDroneId;
    followRef.current = follow;
    onSelectRef.current = onSelect;
    onFollowDisengageRef.current = onFollowDisengage;
  });

  useEffect(() => {
    if (mapRef.current || !containerRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: KYIV,
      zoom: 12,
      zoomControl: true,
      // Tracks grow to TRACK_POINT_LIMIT points and change five times a second.
      // The SVG renderer re-serialises the whole path on every update; canvas
      // rasterises instead, which is far cheaper at this length and cadence.
      preferCanvas: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // A manual drag wins over follow mode; otherwise panTo drags the view back
    // five times a second and the map fights the operator.
    map.on('dragstart', () => {
      if (followRef.current) {
        onFollowDisengageRef.current();
      }
    });

    mapRef.current = map;
    // Captured now: by cleanup time the ref may point somewhere else.
    const layers = layersRef.current;
    const flightLayer = flightLayerRef;

    return () => {
      map.remove();
      mapRef.current = null;
      layers.clear();
      // The polyline died with the map; leaving the ref set would make the next
      // showFlight() call remove() a layer that belongs to no map.
      flightLayer.current = null;
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
    if (!map) {
      return;
    }

    // Reconcile removals first: a drone that left the mission set keeps its
    // marker and polyline on the map forever otherwise.
    const active = new Set(missions.map((mission) => mission.droneId));
    for (const [droneId, layers] of layersRef.current) {
      if (!active.has(droneId)) {
        layers.marker.remove();
        layers.track.remove();
        layersRef.current.delete(droneId);
      }
    }

    if (!history || missions.length === 0) {
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

      const selected = mission.droneId === selectedRef.current;
      const track = L.polyline(latLngs, {
        color: mission.colour,
        weight: 3,
        // Douglas-Peucker simplification at draw time; invisible at these scales.
        smoothFactor: 2,
      }).addTo(map);
      const marker = L.marker(
        last ? [last.lat, last.lon] : [mission.waypoints[0]!.lat, mission.waypoints[0]!.lon],
        { icon: arrowIcon(mission.colour, selected) },
      )
        .addTo(map)
        .on('click', () => onSelectRef.current(mission.droneId));

      const svg = iconSvg(marker);
      if (svg && last) {
        svg.style.transform = `rotate(${last.heading}deg)`;
      }

      layersRef.current.set(mission.droneId, {
        marker,
        track,
        svg,
        colour: mission.colour,
        selected,
      });
    }
    // Deliberately not depending on selectedDroneId or onSelect: both are only
    // read when a layer is first created, and re-running this effect would reset
    // every track to the stale REST seed.
  }, [history, missions]);

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

          const selected = point.droneId === selectedRef.current;
          const position: L.LatLngTuple = [point.lat, point.lon];
          layers.marker.setLatLng(position);

          // One style write per frame instead of rebuilding the marker element.
          if (!layers.svg) {
            layers.svg = iconSvg(layers.marker);
          }
          if (layers.svg) {
            layers.svg.style.transform = `rotate(${point.heading}deg)`;
          }

          // Selection changes on a click, not on a frame — rebuild the icon only then.
          if (selected !== layers.selected) {
            layers.selected = selected;
            layers.marker.setIcon(arrowIcon(layers.colour, selected));
            layers.svg = iconSvg(layers.marker);
            if (layers.svg) {
              layers.svg.style.transform = `rotate(${point.heading}deg)`;
            }
          }

          layers.track.addLatLng(position);

          // Trim in blocks rather than one point per frame: dropping a single
          // element from a 2000-entry array reallocates the whole thing, and at
          // 5 Hz across the fleet that is the dominant cost once the cap is hit.
          const line = layers.track.getLatLngs() as L.LatLng[];
          if (line.length > TRACK_POINT_LIMIT + TRACK_TRIM_BLOCK) {
            layers.track.setLatLngs(line.slice(line.length - TRACK_POINT_LIMIT));
          }

          if (followRef.current && selected) {
            map.panTo(position, { animate: false });
          }
        }
      },

      trackLength(droneId: string): number {
        const layers = layersRef.current.get(droneId);
        return layers ? (layers.track.getLatLngs() as L.LatLng[]).length : 0;
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

  return (
    <div
      ref={containerRef}
      // Leaflet owns the keyboard inside this box (pan, zoom, marker focus), so
      // screen readers should hand keystrokes through rather than intercept them.
      role="application"
      aria-label="Fleet map — live drone positions and flown tracks"
      className="h-full w-full"
    />
  );
});
