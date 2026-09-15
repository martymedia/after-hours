"use client";

// Avatar of a launch token. Metadata images live on IPFS gateways and
// random hosts and often fail to load, so a broken image falls back to the
// ticker letters instead of the browser's broken-image icon.

import { useState } from "react";

export function PoolAvatar({
  image,
  symbol,
  name,
  size = 32,
}: {
  image: string | null;
  symbol: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const letters = (symbol ?? (name.startsWith("(") ? "?" : name))
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
  const fontSize = Math.max(
    9,
    Math.round(size * (letters.length > 2 ? 0.28 : 0.34)),
  );
  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-soft object-cover"
        style={{ width: size, height: size }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="shrink-0 rounded-full bg-ink font-semibold tracking-wide text-white inline-flex items-center justify-center"
      style={{ width: size, height: size, fontSize }}
      aria-hidden="true"
    >
      {letters || "?"}
    </span>
  );
}
