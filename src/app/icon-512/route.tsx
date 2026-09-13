import { ImageResponse } from "next/og";
import { INK, MOON_PATHS } from "@/lib/brand";

/** Maskable 512 px icon for the web app manifest (safe zone kept inside 80%). */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: INK }}>
        <svg width="300" height="300" viewBox="0 0 40 40">
          {MOON_PATHS.map((d) => (
            <path key={d} d={d} fill="#ffffff" />
          ))}
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
