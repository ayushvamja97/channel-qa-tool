import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { embed, embeddingModel, AiError } from "./provider";
import { cosine, vector } from "./math";

export function postText(post: { title: string; body: string }) { return `${post.title}\n${post.body}`.slice(0, 12_000); }
export function contentHash(text: string) { return createHash("sha256").update(text).digest("hex"); }

export async function indexPost(post: { id: number; title: string; body: string }) {
  const text = postText(post), hash = contentHash(text), model = embeddingModel();
  const old = await prisma.postEmbedding.findUnique({ where: { postId: post.id } });
  if (old?.contentHash === hash && old.model === model) return false;
  const embedding = await embed(text);
  await prisma.postEmbedding.upsert({ where: { postId: post.id },
    create: { postId: post.id, contentHash: hash, model, vector: embedding },
    update: { contentHash: hash, model, vector: embedding },
  });
  return true;
}

export async function similarQuestions(text: string, excludePostId?: number) {
  // Bounded linear scan deliberately suits the small demo. Never silently search a partial index.
  const model = embeddingModel();
  const count = await prisma.postEmbedding.count({ where: { model } });
  if (count > 5000) throw new AiError("The demo index is too large; configure a vector search service.");
  if (!count) throw new AiError("No questions are indexed yet. Ask the administrator to run npm run ai:index.");
  const rows = await prisma.postEmbedding.findMany({ where: { model }, include: { post: { select: { id: true, title: true, body: true, channel: { select: { name: true } } } } } });
  const query = await embed(text);
  return rows.filter(row => row.postId !== excludePostId && row.contentHash === contentHash(postText(row.post)))
    .map(row => ({ id: row.postId, title: row.post.title, channel: row.post.channel.name, score: cosine(query, vector(row.vector)) }))
    .filter(row => row.score >= 0.3).sort((a, b) => b.score - a.score).slice(0, 5);
}
