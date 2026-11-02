import { z } from "zod";
import { AiError } from "./provider";

export const summarySchema = z.object({
  overview: z.string().max(1200),
  points: z.array(z.object({ text: z.string().max(600), replyIds: z.array(z.number().int().positive()).min(1).max(8) })).max(8),
  unresolved: z.array(z.string().max(400)).max(6),
});

export function validateCitations(summary: z.infer<typeof summarySchema>, replyIds: number[]) {
  const allowed = new Set(replyIds);
  if (summary.points.some(point => point.replyIds.some(id => !allowed.has(id)))) {
    throw new AiError("The summary contained an invalid source. Please try again.");
  }
  return summary;
}
