// Dot-matrix globe for the generated share images: the same land-110m data
// the three.js globe uses, sampled on a golden spiral and tested against the
// land polygons (no canvas on the server), then projected orthographically
// onto a disc. Returns only the visible hemisphere.

import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import landTopology from "world-atlas/land-110m.json";

const DEG = Math.PI / 180;

export type GlobeDot = { x: number; y: number; depth: number; night: boolean };

let polygons: Position[][][] | null = null;

function landPolygons(): Position[][][] {
  if (polygons) return polygons;
  const topo = landTopology as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land) as Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon>;
  const geometries = land.type === "FeatureCollection" ? land.features.map((f) => f.geometry) : [land.geometry];
  polygons = geometries.flatMap((g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates));
  return polygons;
}

function inRing(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function isLand(lon: number, lat: number): boolean {
  for (const rings of landPolygons()) {
    if (!inRing(lon, lat, rings[0])) continue;
    let hole = false;
    for (let k = 1; k < rings.length; k++) if (inRing(lon, lat, rings[k])) hole = true;
    if (!hole) return true;
  }
  return false;
}

/**
 * Visible land dots for a globe centred on (lon0, lat0). x and y are in
 * -1..1 (y up), depth is 0 at the rim and 1 at the centre. Dots west of the
 * terminator (a fixed line for the still image) are marked night.
 */
const dotCache = new Map<string, GlobeDot[]>();

export function globeDots(count: number, lon0: number, lat0: number, terminatorLon: number): GlobeDot[] {
  const key = `${count}|${lon0}|${lat0}|${terminatorLon}`;
  const hit = dotCache.get(key);
  if (hit) return hit;
  const out = computeDots(count, lon0, lat0, terminatorLon);
  dotCache.set(key, out);
  return out;
}

function computeDots(count: number, lon0: number, lat0: number, terminatorLon: number): GlobeDot[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: GlobeDot[] = [];
  const sinLat0 = Math.sin(lat0 * DEG);
  const cosLat0 = Math.cos(lat0 * DEG);
  for (let i = 0; i < count; i++) {
    const yy = 1 - (2 * (i + 0.5)) / count;
    const lat = Math.asin(yy) / DEG;
    const lon = ((i * golden) % (2 * Math.PI)) / DEG - 180;
    const dLon = (lon - lon0) * DEG;
    const cosC = sinLat0 * Math.sin(lat * DEG) + cosLat0 * Math.cos(lat * DEG) * Math.cos(dLon);
    if (cosC <= 0.02) continue;
    if (!isLand(lon, lat)) continue;
    const x = Math.cos(lat * DEG) * Math.sin(dLon);
    const y = cosLat0 * Math.sin(lat * DEG) - sinLat0 * Math.cos(lat * DEG) * Math.cos(dLon);
    const night = ((lon - terminatorLon + 540) % 360) - 180 > 0;
    out.push({ x, y, depth: cosC, night });
  }
  return out;
}

/** New York on the same projection, for the marker. */
export function project(lon: number, lat: number, lon0: number, lat0: number): { x: number; y: number } | null {
  const dLon = (lon - lon0) * DEG;
  const cosC = Math.sin(lat0 * DEG) * Math.sin(lat * DEG) + Math.cos(lat0 * DEG) * Math.cos(lat * DEG) * Math.cos(dLon);
  if (cosC <= 0) return null;
  return {
    x: Math.cos(lat * DEG) * Math.sin(dLon),
    y: Math.cos(lat0 * DEG) * Math.sin(lat * DEG) - Math.sin(lat0 * DEG) * Math.cos(lat * DEG) * Math.cos(dLon),
  };
}
