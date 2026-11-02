import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../auth/jwt";
import { prisma } from "../prisma";
import { AiError } from "./provider";
import { z } from "zod";

// Per-process abuse guard for the single-instance demo; use a shared store when scaling.
const limits = new Map<number, { count: number; reset: number }>();
export async function authorizeAI(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) throw new AiError("Same-origin request required.", 403);
  const token = request.cookies.get("auth_token")?.value;
  const session = token ? verifyToken(token) : null;
  if (!session) throw new AiError("Sign in to use AI assistance.", 401);
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } });
  if (!user) throw new AiError("Sign in again to use AI assistance.", 401);
  const now = Date.now();
  for (const [id, value] of limits) if (value.reset <= now) limits.delete(id);
  const window = limits.get(user.id) || { count: 0, reset: now + 60_000 };
  if (window.count >= 6) throw new AiError("Please wait a minute before requesting more AI assistance.", 429);
  window.count++; limits.set(user.id, window);
  return user;
}

export async function readAIInput(request: NextRequest) {
  // Enforce the limit even for chunked requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new AiError("A JSON body is required.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24_000) { await reader.cancel(); throw new AiError("Request is too large.", 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError("Invalid JSON body.", 400);
  }
}

export function aiFailure(error: unknown) {
  const status = error instanceof AiError ? error.status : error instanceof z.ZodError ? 400 : 503;
  const message = error instanceof AiError ? error.message : status === 400 ? "Check the supplied question or image." : "AI assistance is temporarily unavailable. Your content is unchanged.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
