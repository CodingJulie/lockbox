export type SecurityHeader = { key: string; value: string };

/** 2 years — required for HSTS preload. */
export const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

export function buildContentSecurityPolicy(isProd: boolean): string {
  const scriptSrc = [
    "'self'",
    // Next.js inlines a small hydration/RSC bootstrap. A per-request nonce
    // in middleware can replace this; headers() in next.config cannot.
    "'unsafe-inline'",
    // ffmpeg.wasm compiles WebAssembly from a blob URL.
    "'wasm-unsafe-eval'",
    ...(isProd ? [] : ["'unsafe-eval'"]),
    "blob:",
  ].join(" ");

  const connectSrc = ["'self'", ...(isProd ? [] : ["ws:", "wss:"])].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
  ];

  if (isProd) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function buildPermissionsPolicy(): string {
  return [
    "camera=(self)",
    "microphone=(self)",
    "autoplay=(self)",
    "clipboard-write=(self)",
    "fullscreen=(self)",
    "clipboard-read=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "bluetooth=()",
    "midi=()",
    "display-capture=()",
    "browsing-topics=()",
    "interest-cohort=()",
    "accelerometer=()",
    "gyroscope=()",
    "magnetometer=()",
    "ambient-light-sensor=()",
    "picture-in-picture=()",
    "publickey-credentials-get=()",
    "screen-wake-lock=()",
    "serial=()",
    "hid=()",
    "xr-spatial-tracking=()",
    "idle-detection=()",
  ].join(", ");
}

export function getGlobalSecurityHeaders(
  isProd = process.env.NODE_ENV === "production"
): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(isProd) },
    { key: "Permissions-Policy", value: buildPermissionsPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];

  if (isProd) {
    headers.unshift({ key: "Strict-Transport-Security", value: HSTS_VALUE });
  }

  return headers;
}
