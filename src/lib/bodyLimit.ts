// Caps request body size via Content-Length so we don't buffer huge payloads
// before `req.json()` or `req.formData()`. Returns a 413 Response if over.
export function enforceBodySize(req: Request, maxBytes: number): Response | null {
  const header = req.headers.get("content-length");
  if (!header) return null;
  const len = Number(header);
  if (!Number.isFinite(len)) return null;
  if (len > maxBytes) {
    return Response.json(
      { error: "payload too large", max_bytes: maxBytes },
      { status: 413 }
    );
  }
  return null;
}

// Standard caps per route family.
export const BODY_LIMITS = {
  // Text-only JSON endpoints (chat turns, analysis inputs).
  textJson: 32 * 1024, // 32 KB
  // Transcript-heavy routes (review of a whole conversation).
  transcript: 256 * 1024, // 256 KB
  // Base64 audio upload in a JSON body (listen mode).
  audioJson: 20 * 1024 * 1024, // 20 MB
  // Multipart audio upload.
  audioMultipart: 25 * 1024 * 1024, // 25 MB
} as const;
