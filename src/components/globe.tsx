"use client";

// Earth at night. A dot-matrix globe on a dark ground: land is drawn as
// points, and on the night side of the real terminator the points glow blue
// like city lights. Where Wall Street sleeps, the lights are on. New York is
// marked. This is the one animation on the page and it means something.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import landTopology from "world-atlas/land-110m.json";

const DEG = Math.PI / 180;
const NEW_YORK = { lon: -74.006, lat: 40.7128 };
const DOT_COUNT = 30000;

function toVector(lon: number, lat: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** Direction from the earth's centre to the sun, good to about a degree. */
function sunDirection(date: Date): THREE.Vector3 {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (date.getTime() - startOfYear) / 86400_000;
  const declination = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const subsolarLon = -15 * (utcHours - 12);
  return toVector(subsolarLon, declination).normalize();
}

/** Rasterizes the land polygons into an equirectangular mask. */
function landMask(width: number, height: number): Uint8ClampedArray {
  const topo = landTopology as unknown as Topology<{ land: GeometryCollection }>;
  const land = feature(topo, topo.objects.land) as Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon>;
  const geometries = land.type === "FeatureCollection" ? land.features.map((f) => f.geometry) : [land.geometry];

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff";

  const trace = (ring: Position[]) => {
    ring.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };
  for (const g of geometries) {
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const rings of polygons) {
      ctx.beginPath();
      for (const ring of rings) trace(ring);
      ctx.fill("evenodd");
    }
  }
  return ctx.getImageData(0, 0, width, height).data;
}

/** Evenly spread points on the sphere, kept only where there is land. */
function landPoints(): Float32Array {
  const W = 1440;
  const H = 720;
  const mask = landMask(W, H);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: number[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    const y = 1 - (2 * (i + 0.5)) / DOT_COUNT;
    const lat = Math.asin(y) / DEG;
    const lon = ((i * golden) % (2 * Math.PI)) / DEG - 180;
    const px = Math.floor(((lon + 180) / 360) * W);
    const py = Math.floor(((90 - lat) / 180) * H);
    if (mask[(py * W + px) * 4] > 127) {
      const v = toVector(lon, lat, 1.004);
      out.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(out);
}

const DOT_SHADER = {
  vertexShader: `
    uniform float pixelRatio;
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(position);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = 1.9 * pixelRatio * (4.3 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform vec3 sunDir;
    uniform vec3 dayColor;
    uniform vec3 nightColor;
    varying vec3 vNormal;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      if (dot(c, c) > 0.25) discard;
      float d = dot(vNormal, normalize(sunDir));
      float night = smoothstep(0.15, -0.12, d);
      vec3 color = mix(dayColor, nightColor, night);
      float alpha = mix(0.6, 1.0, night);
      gl_FragColor = vec4(color, alpha);
    }
  `,
};

const RIM_SHADER = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform vec3 rimColor;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 3.5);
      gl_FragColor = vec4(rimColor, rim * 0.45);
    }
  `,
};

export function Globe({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
    // The sphere has radius 1; at z = 4.3 with a 30 degree lens it fills about
    // 85 percent of the frame instead of overflowing it.
    camera.position.set(0, 0, 4.3);

    const globe = new THREE.Group();
    scene.add(globe);

    // Body: a shade lighter than the ground so the disc reads, plus a soft rim.
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: 0x1b1c22 })));
    globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 64, 48),
        new THREE.ShaderMaterial({
          ...RIM_SHADER,
          uniforms: { rimColor: { value: new THREE.Color(0x5b91ff) } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );

    const sunUniform = { value: new THREE.Vector3(1, 0, 0) };
    const dots = new THREE.BufferGeometry();
    dots.setAttribute("position", new THREE.BufferAttribute(landPoints(), 3));
    globe.add(
      new THREE.Points(
        dots,
        new THREE.ShaderMaterial({
          ...DOT_SHADER,
          uniforms: {
            sunDir: sunUniform,
            pixelRatio: { value: pixelRatio },
            dayColor: { value: new THREE.Color(0x454956) },
            nightColor: { value: new THREE.Color(0x8fb3ff) },
          },
          transparent: true,
          depthWrite: false,
        }),
      ),
    );

    // New York, where the bell rings.
    const amber = new THREE.Color(0xffffff);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 16), new THREE.MeshBasicMaterial({ color: amber }));
    marker.position.copy(toVector(NEW_YORK.lon, NEW_YORK.lat, 1.012));
    globe.add(marker);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.036, 0.044, 40),
      new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.position.copy(toVector(NEW_YORK.lon, NEW_YORK.lat, 1.014));
    ring.lookAt(ring.position.clone().multiplyScalar(2));
    globe.add(ring);

    // Face New York, tilt a little so the northern hemisphere reads well.
    const ny = toVector(NEW_YORK.lon, NEW_YORK.lat);
    const baseYaw = -Math.atan2(ny.x, ny.z) - 0.45;
    globe.rotation.x = 0.3;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const localSun = new THREE.Vector3();
    const inverse = new THREE.Quaternion();

    const resize = () => {
      const size = Math.max(280, Math.min(mount.clientWidth, 640));
      renderer.setSize(size, size, false);
      // CSS size follows the container so the canvas can never widen the layout.
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    const start = performance.now();
    const render = (t: number) => {
      const elapsed = (t - start) / 1000;
      globe.rotation.y = baseYaw + (reducedMotion ? 0 : elapsed * 0.02 + Math.sin(elapsed / 7) * 0.05);
      inverse.copy(globe.quaternion).invert();
      localSun.copy(sunDirection(new Date())).applyQuaternion(inverse);
      sunUniform.value.copy(localSun);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __globe?: unknown }).__globe = { renderer, scene, camera, globe };
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      dots.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={`aspect-square w-full min-w-0 ${className}`} aria-hidden="true" />;
}
