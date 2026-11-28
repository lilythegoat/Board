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
 * The wordmark, drawn in the same chunky hand-drawn style as the brand
 * artwork: b, o, a, r, d, with the "a" traced from the old wordmark. The
 * letters take the colour of the text around them and the sparkles keep the
 * brand purple, so one drawing works on a dark screen, a light one and a
 * purple banner.
 */
const WORDMARK_LETTERS =
  "M0.0 21.62 18.53 21.62 18.53 76.25 0.0 76.25Z M18.53 35.87 52.49 35.87 52.49 76.25 18.53 76.25Z M27.0 44.42 27.0 67.7 44.0 67.7 44.0 44.42Z M58.67 22.8 104.28 21.62 110.93 24.23 110.93 71.97 104.28 76.25 64.13 76.25 58.67 71.97Z M68.0 31.12 68.0 67.7 102.0 67.7 102.0 31.12Z M119.32 22.09 158.04 22.09 168.25 31.35 168.25 76.72 139.28 76.72 134.76 75.53 120.04 72.45 116 52.49 122.89 43.94 150.68 43.94 150.68 35.87 119.32 35.63Z M134.52 55.34 134.29 63.18 150.44 63.18 150.44 55.34Z M174.0 21.62 192.53 21.62 192.53 76.25 174.0 76.25Z M192.53 21.62 226.49 21.62 226.49 44.42 192.53 44.42Z M194.0 44.42 212.0 44.42 220.0 76.25 200.0 76.25Z M232.0 35.87 265.96 35.87 265.96 76.25 232.0 76.25Z M240.47 44.42 240.47 67.7 257.45 67.7 257.45 44.42Z M265.96 21.62 284.49 21.62 284.49 76.25 265.96 76.25Z";
const WORDMARK_SPARK =
  "M54.87 0.0 59.62 20.9 80.52 25.42 59.62 29.93 55.11 50.83 50.36 29.93 29.45 25.65 50.59 20.9Z M260.96 53.21 265.24 72.45 284.48 76.48 265.24 80.76 261.2 100 256.92 80.76 237.68 76.72 256.92 72.45Z";

export function NexaWordmark({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <svg
      className={className}
      height={height}
      viewBox="0 0 286 100"
      role="img"
      aria-label="Board"
      style={{ display: "block", width: "auto" }}
    >
      <path d={WORDMARK_LETTERS} fill="currentColor" fillRule="evenodd" />
      <path d={WORDMARK_SPARK} fill="var(--brand, #8000ff)" fillRule="evenodd" />
    </svg>
  );
}
