"use client";

// A line-drawn globe in ink on paper. The night side is shaded from the real
// position of the sun, so when New York sits in the dark, Wall Street is
// closed. That is the one animation on the page, and it means something.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import landTopology from "world-atlas/land-110m.json";

const DEG = Math.PI / 180;
const NEW_YORK = { lon: -74.006, lat: 40.7128 };

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

function landSegments(): Float32Array {
  const topo = landTopology as unknown as Topology<{ land: GeometryCollection }>;
  const lines = mesh(topo, topo.objects.land);
  const out: number[] = [];
  const r = 1.003;
  for (const line of lines.coordinates) {
    for (let i = 1; i < line.length; i++) {
      const a = toVector(line[i - 1][0], line[i - 1][1], r);
      const b = toVector(line[i][0], line[i][1], r);
      out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  return new Float32Array(out);
}

function graticuleSegments(): Float32Array {
  const out: number[] = [];
  const r = 1.001;
  const push = (a: THREE.Vector3, b: THREE.Vector3) => out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = -180; lon < 180; lon += 3) push(toVector(lon, lat, r), toVector(lon + 3, lat, r));
  }
  for (let lon = -180; lon < 180; lon += 30) {
    for (let lat = -90; lat < 90; lat += 3) push(toVector(lon, lat, r), toVector(lon, lat + 3, r));
  }
  return new Float32Array(out);
}

const NIGHT_SHADER = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 sunDir;
    uniform vec3 ink;
    varying vec3 vNormal;
    void main() {
      float d = dot(normalize(vNormal), normalize(sunDir));
      float night = smoothstep(0.12, -0.14, d);
      gl_FragColor = vec4(ink, night * 0.17);
    }
  `,
};

export function Globe({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const styles = getComputedStyle(document.documentElement);
    const ink = new THREE.Color(styles.getPropertyValue("--ink").trim() || "#161616");
    const accent = new THREE.Color(styles.getPropertyValue("--accent").trim() || "#c98a2e");
    const surface = new THREE.Color(styles.getPropertyValue("--surface").trim() || "#ffffff");

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 10);
    camera.position.set(0, 0, 4.6);

    const globe = new THREE.Group();
    scene.add(globe);

    // Opaque body hides the far side of the line work.
    globe.add(
      new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: surface })),
    );

    const lineMaterial = (opacity: number) =>
      new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity });
    const grat = new THREE.BufferGeometry();
    grat.setAttribute("position", new THREE.BufferAttribute(graticuleSegments(), 3));
    globe.add(new THREE.LineSegments(grat, lineMaterial(0.13)));
    const land = new THREE.BufferGeometry();
    land.setAttribute("position", new THREE.BufferAttribute(landSegments(), 3));
    globe.add(new THREE.LineSegments(land, lineMaterial(0.7)));

    const sunUniform = { value: new THREE.Vector3(1, 0, 0) };
    const night = new THREE.Mesh(
      new THREE.SphereGeometry(1.006, 64, 48),
      new THREE.ShaderMaterial({
        ...NIGHT_SHADER,
        uniforms: { sunDir: sunUniform, ink: { value: ink } },
        transparent: true,
        depthWrite: false,
      }),
    );
    globe.add(night);

    // New York, where the bell rings.
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 16),
      new THREE.MeshBasicMaterial({ color: accent }),
    );
    marker.position.copy(toVector(NEW_YORK.lon, NEW_YORK.lat, 1.01));
    globe.add(marker);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.035, 0.042, 32),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    ring.position.copy(toVector(NEW_YORK.lon, NEW_YORK.lat, 1.012));
    ring.lookAt(ring.position.clone().multiplyScalar(2));
    globe.add(ring);

    // Face New York, tilt a little so the northern hemisphere reads well.
    const ny = toVector(NEW_YORK.lon, NEW_YORK.lat);
    const baseYaw = -Math.atan2(ny.x, ny.z) - 0.35;
    globe.rotation.x = 0.28;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const localSun = new THREE.Vector3();
    const inverse = new THREE.Quaternion();

    const resize = () => {
      const size = Math.min(mount.clientWidth, 520);
      renderer.setSize(size, size, false);
      renderer.domElement.style.width = `${size}px`;
      renderer.domElement.style.height = `${size}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    const start = performance.now();
    const render = (t: number) => {
      const elapsed = (t - start) / 1000;
      globe.rotation.y = baseYaw + (reducedMotion ? 0 : Math.sin(elapsed / 9) * 0.16);
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
      grat.dispose();
      land.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={`aspect-square w-full ${className}`} aria-hidden="true" />;
}
