"use client";

// One day as a ring in space. The full ring is the onchain market, which
// never closes; the white arc is Wall Street's regular session (9:30 AM to
// 4 PM New York); the bright dot is the time right now. Small points stream
// along the ring the whole way round: trades keep flowing after the bell.
// Nothing here is data beyond the clock; it is the day, drawn.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { nyParts } from "@/lib/market-phase";

const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;
const TAU = Math.PI * 2;
const PARTICLES = 700;

/** Point on the ring for a New York minute: midnight at the far side, clockwise seen from above. */
function onRing(
  minutes: number,
  r = 1,
  y = 0,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const th = (minutes / 1440) * TAU;
  return target.set(Math.sin(th) * r, y, -Math.cos(th) * r);
}

class RingArc extends THREE.Curve<THREE.Vector3> {
  private from: number;
  private to: number;
  private r: number;
  constructor(from: number, to: number, r = 1) {
    super();
    this.from = from;
    this.to = to;
    this.r = r;
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return onRing(this.from + (this.to - this.from) * t, this.r, 0, target);
  }
}

export function DayRing({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Far enough back that the ticks at radius 1.17 and the halo around the
    // marker stay inside the frame: at the old distance they projected past
    // the edge and the ring was cut off.
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 2.67, 4.03);
    camera.lookAt(0, -0.05, 0);

    const group = new THREE.Group();
    scene.add(group);

    const blue = new THREE.Color(0x5b91ff);
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      geometries.push(geo);
      materials.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      return mesh;
    };

    // The whole day: the onchain market.
    add(
      new THREE.TubeGeometry(new RingArc(0, 1440), 180, 0.032, 16, true),
      new THREE.MeshBasicMaterial({
        color: blue,
        transparent: true,
        opacity: 0.5,
      }),
    );
    // Wall Street's session, a little thicker and solid white.
    add(
      new THREE.TubeGeometry(new RingArc(OPEN, CLOSE), 64, 0.048, 16, false),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    // Session ends, rounded.
    for (const m of [OPEN, CLOSE]) {
      const cap = add(
        new THREE.SphereGeometry(0.048, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      onRing(m, 1, 0, cap.position);
    }
    // Six-hour ticks outside the ring.
    for (const m of [0, 360, 720, 1080]) {
      const tick = add(
        new THREE.BoxGeometry(0.018, 0.018, 0.09),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.35,
        }),
      );
      onRing(m, 1.17, 0, tick.position);
      tick.lookAt(0, 0, 0);
    }
    // Now.
    const marker = add(
      new THREE.SphereGeometry(0.07, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    const halo = add(
      new THREE.SphereGeometry(0.125, 24, 24),
      new THREE.MeshBasicMaterial({
        color: blue,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );

    // Trades, streaming round the clock.
    const positions = new Float32Array(PARTICLES * 3);
    const phase = new Float32Array(PARTICLES);
    const radius = new Float32Array(PARTICLES);
    const height = new Float32Array(PARTICLES);
    const speed = new Float32Array(PARTICLES);
    for (let i = 0; i < PARTICLES; i++) {
      phase[i] = Math.random() * TAU;
      radius[i] = 1 + (Math.random() - 0.5) * 0.34;
      height[i] = (Math.random() - 0.5) * 0.14;
      speed[i] = 0.04 + Math.random() * 0.09;
    }
    const cloud = new THREE.BufferGeometry();
    cloud.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const cloudMat = new THREE.PointsMaterial({
      color: 0x8fb3ff,
      size: 0.02,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    geometries.push(cloud);
    materials.push(cloudMat);
    group.add(new THREE.Points(cloud, cloudMat));

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const placeParticles = (t: number) => {
      for (let i = 0; i < PARTICLES; i++) {
        const th = phase[i] + t * speed[i];
        positions[i * 3] = Math.sin(th) * radius[i];
        positions[i * 3 + 1] = height[i];
        positions[i * 3 + 2] = -Math.cos(th) * radius[i];
      }
      cloud.attributes.position.needsUpdate = true;
    };
    placeParticles(0);

    const resize = () => {
      const size = Math.max(240, Math.min(mount.clientWidth, 560));
      renderer.setSize(size, size, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let frame = 0;
    const start = performance.now();
    const render = (now: number) => {
      const t = (now - start) / 1000;
      const date = new Date();
      const minutes = nyParts(date).minutes + date.getSeconds() / 60;
      onRing(minutes, 1, 0, marker.position);
      halo.position.copy(marker.position);
      if (!reduced) {
        group.rotation.y = Math.sin(t / 11) * 0.14;
        group.rotation.z = Math.sin(t / 13) * 0.03;
        halo.scale.setScalar(1 + 0.18 * Math.sin(t * 2.2));
        placeParticles(t);
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`aspect-square w-full min-w-0 ${className}`}
      aria-hidden="true"
    />
  );
}
