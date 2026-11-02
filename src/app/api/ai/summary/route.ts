import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeAI, readAIInput, aiFailure } from "@/lib/ai/access";
import { generate, AiError } from "@/lib/ai/provider";
import { summarySchema, validateCitations } from "@/lib/ai/summary";

export async function POST(request: NextRequest) {
  try {
    await authorizeAI(request);
    const { postId } = z.object({ postId: z.number().int().positive() }).parse(await readAIInput(request));
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { title: true, body: true, replies: { orderBy: { createdAt: "asc" }, take: 41, select: { id: true, parentReplyId: true, body: true } } } });
    if (!post) throw new AiError("Discussion not found.", 404);
    if (!post.replies.length) throw new AiError("Add replies before summarizing this discussion.", 400);
    if (post.replies.length > 40 || JSON.stringify(post).length > 24_000) throw new AiError("This discussion exceeds the current summary limit (40 replies / 24,000 characters).", 400);
    const result = await generate("discussion_summary", "Summarize only this discussion. Attribute proposed solutions to replies using their exact IDs. Separate unresolved questions. Do not declare an answer correct or accepted unless established by the supplied text. Return plain text.", post, summarySchema);
    return NextResponse.json({ summary: validateCitations(result, post.replies.map(r => r.id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return aiFailure(error); }
}
