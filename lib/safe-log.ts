/** Strip auth material so Vercel runtime logs never capture vault proofs. */
export function redactSecrets(value: string): string {
  return value
    .replace(/Authorization\s*[:=]\s*.*/gi, "Authorization: [REDACTED]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");
}

export function logServerError(context: string, error: unknown): void {
  if (typeof error === "string") {
    console.error(context, redactSecrets(error));
    return;
  }
  if (error instanceof Error) {
    console.error(context, redactSecrets(error.message));
    return;
  }
  console.error(context, "unknown error");
}
