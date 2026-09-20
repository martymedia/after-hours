// Brand constants shared by the React logo, the favicon, the app icon and the
// Open Graph images (which render through Satori, where SVG masks are not
// available, so the crescents are plain paths here).

export const SITE_URL = "https://after-hour.net";
export const SITE_NAME = "After Hours";
export const REPO_URL = "https://github.com/martymedia/after-hours";
export const TAGLINE = "Trade stocks when Wall Street sleeps.";
export const DESCRIPTION =
  "Tokenized stocks keep trading on Solana after the bell and all weekend. See which ones are moving, whether the onchain price is fresh, how far it drifts from the last Wall Street print, and buy from your own wallet.";

export const INK = "#121214";
export const BLUE = "#5b91ff";
export const BG = "#eceef2";

/** Three crescents in a 40 x 40 box: each a disc of radius 12 whose top is
 *  cut away by a flatter disc, so the tips sit on the centre line. */
const MOONS = [0.75, 14.25, 27.75];
export const MOON_PATHS = MOONS.map((cy) => `M8,${cy} A12,12 0 0 0 32,${cy} A15.84,15.84 0 0 1 8,${cy} Z`);

/** Standalone SVG markup of the mark, for files that cannot use React. */
export function markSvg(color: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">${MOON_PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join("")}</svg>`;
}
