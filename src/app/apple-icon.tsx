import { ImageResponse } from "next/og";
import { INK, MOON_PATHS } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the three moons in white on ink. iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: INK }}>
        <svg width="116" height="116" viewBox="0 0 40 40">
          {MOON_PATHS.map((d) => (
            <path key={d} d={d} fill="#ffffff" />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
