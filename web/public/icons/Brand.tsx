
/** Board's logo: the hand-drawn "b" artwork, shown wherever the app puts its mark. */
export function NexaMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <img className={className} src="/icons/icon-512.png" alt="" aria-hidden="true" width={size} height={size} style={{ borderRadius: Math.round(size * 0.225), display: "block" }} />
  );
}

/** The logo as the app icon itself. */
export function NexaTile({ size = 48, radius = 0.225, className }: { size?: number; radius?: number; className?: string }) {
  return (
    <img className={className} src="/icons/icon-512.png" alt="" aria-hidden="true" width={size} height={size} style={{ borderRadius: Math.round(size * radius), display: "block" }} />
  );
}

/**
 * The wordmark, traced from the brand artwork. The letters take the colour of
 * the text around them and the sparkles keep the brand purple, so one drawing
 * works on a dark screen, a light one and a purple banner.
 */
const WORDMARK_LETTERS =
  "M119.0 20.43 136.82 20.43 136.58 29.22 137.29 31.59 138.95 34.44 144.18 39.19 149.64 34.44 151.78 31.35 152.26 20.43 169.6 20.43 169.6 35.63 156.29 48.69 170.31 63.42 170.31 72.92 168.88 73.4 155.58 76.25 152.02 76.25 152.26 71.02 151.07 66.51 148.22 62.23 144.89 59.38 143.94 59.38 140.38 62.0 137.29 66.75 136.58 69.36 136.82 76.25 118.29 76.01 118.29 63.66 131.83 49.64 119.0 36.1ZM0.0 21.62 40.14 21.62 41.81 22.8 29.45 25.65 50.59 30.17 52.49 38.72 52.49 76.25 33.73 76.25 33.73 66.98 33.73 35.87 18.53 35.87 18.53 76.25 0.0 76.25ZM70.31 21.62 99.52 21.62 104.28 24.23 109.74 29.69 110.93 31.12 110.93 49.64 106.65 55.34 76.96 55.34 76.96 62.71 109.26 62.71 109.26 66.27 109.26 76.25 68.17 76.25 64.13 71.97 58.67 67.7 58.67 34.2 59.62 30.17 80.52 25.65 68.41 22.8ZM180.52 22.09 219.24 22.09 229.45 31.35 229.45 76.72 200.48 76.72 195.96 75.53 181.24 72.45 177.2 52.49 184.09 43.94 211.88 43.94 211.88 35.87 180.52 35.63ZM77.2 34.44 76.96 44.42 92.64 44.42 92.64 34.44ZM195.72 55.34 195.49 63.18 211.64 63.18 211.64 55.34Z";
const WORDMARK_SPARK =
  "M54.87 0.0 59.62 20.9 80.52 25.42 59.62 29.93 55.11 50.83 50.36 29.93 29.45 25.65 50.59 20.9ZM176.96 53.21 181.24 72.45 200.48 76.48 181.24 80.76 177.2 100.0 172.92 80.76 153.68 76.72 172.92 72.45Z";

export function NexaWordmark({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <svg
      className={className}
      height={height}
      viewBox="0 0 229.45 100"
      role="img"
      aria-label="Nexa"
      style={{ display: "block", width: "auto" }}
    >
      <path d={WORDMARK_LETTERS} fill="currentColor" fillRule="evenodd" />
      <path d={WORDMARK_SPARK} fill="var(--brand, #8000ff)" fillRule="evenodd" />
    </svg>
  );
}
