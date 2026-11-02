import { z } from "zod";
import { AiError } from "./provider";

export async function analyzeImage(bytes: Buffer) {
  const url = process.env.VISION_SERVICE_URL;
  const secret = process.env.VISION_SERVICE_TOKEN;
  if (!url || !secret) throw new AiError("CNN service is not configured. Image upload still works.");
  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/analyze`, { method: "POST", signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/octet-stream", Authorization: `Bearer ${secret}` }, body: new Uint8Array(bytes), cache: "no-store" });
  } catch { throw new AiError("CNN service unavailable. Your uploaded image is unchanged."); }
  if (!response.ok) throw new AiError(response.status === 400 ? "This file could not be decoded as a supported image." : "CNN service could not analyze this image.", response.status === 400 ? 400 : 503);
  return z.object({ model: z.string().max(180), vector: z.array(z.number().finite()).length(576), category: z.string().nullable(), confidence: z.number().min(0).max(1).nullable() }).parse(await response.json());
}
