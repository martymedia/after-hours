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
};

export default nextConfig;
