import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // This repo lives beside sibling projects with their own lockfiles; pin the
  // root so Turbopack does not guess.
  turbopack: { root: projectRoot },
  reactStrictMode: true,
  poweredByHeader: false,
  // Phones on the home network hit the dev server by LAN IP; without this
  // Next blocks their requests for JS chunks and the page never hydrates.
  allowedDevOrigins: ["192.168.178.20", "192.168.178.*", "*.local"],
};

export default nextConfig;
