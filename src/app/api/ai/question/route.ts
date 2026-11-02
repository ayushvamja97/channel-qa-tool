import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAI, readAIInput, aiFailure } from "@/lib/ai/access";
import { generate } from "@/lib/ai/provider";
import { similarQuestions } from "@/lib/ai/retrieval";

const input = z.object({ action: z.enum(["review", "similar"]), title: z.string().min(3).max(180), body: z.string().min(5).max(10_000) });
const review = z.object({ title: z.string().max(180), body: z.string().max(10_000), missingDetails: z.array(z.string().max(400)).max(8) });
export async function POST(request: NextRequest) {
  try {
    await authorizeAI(request);
    const draft = input.parse(await readAIInput(request));
    if (draft.action === "similar") return NextResponse.json({ results: await similarQuestions(`${draft.title}\n${draft.body}`) });
    const suggestion = await generate("question_review", "Improve question clarity. Preserve all code and its meaning. Do not invent environment details or a solution. List missing reproduction details separately. Return plain text, not HTML.", { title: draft.title, body: draft.body }, review);
    return NextResponse.json({ suggestion }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return aiFailure(error); }
}
