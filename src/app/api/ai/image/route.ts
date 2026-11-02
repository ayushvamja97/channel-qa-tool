import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeAI, readAIInput, aiFailure } from "@/lib/ai/access";
import { analyzeImage } from "@/lib/ai/vision";
import { AiError } from "@/lib/ai/provider";
import { cosine, vector } from "@/lib/ai/math";

export async function POST(request: NextRequest) {
  try {
    await authorizeAI(request);
    const { attachmentId } = z.object({ attachmentId: z.number().int().positive() }).parse(await readAIInput(request));
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || (!attachment.postId && !attachment.replyId)) throw new AiError("Attached image not found.", 404);
    if (!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(attachment.path)) throw new AiError("Unsupported attachment filename.", 400);
    const bytes = await readFile(path.join(process.cwd(), "uploads", attachment.path));
    if (bytes.length > 5 * 1024 * 1024) throw new AiError("Image is too large.", 400);
    const result = await analyzeImage(bytes);
    await prisma.imageAnalysis.upsert({ where: { attachmentId }, create: { attachmentId, ...result }, update: result });
    if (await prisma.imageAnalysis.count({ where: { model: result.model } }) > 5000) throw new AiError("The demo image index is too large; configure a vector search service.");
    const rows = await prisma.imageAnalysis.findMany({ where: { model: result.model, attachmentId: { not: attachmentId } }, include: { attachment: { include: { reply: { select: { postId: true } } } } } });
    const similar = rows.map(row => ({ id: row.attachmentId, url: `/uploads/${row.attachment.path}`, postId: row.attachment.postId || row.attachment.reply?.postId, score: cosine(result.vector, vector(row.vector)) }))
      .filter(row => row.postId && row.score >= 0.8).sort((a, b) => b.score - a.score).slice(0, 4);
    return NextResponse.json({ model: result.model, category: result.category, confidence: result.confidence, similar }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return aiFailure(error); }
}
