import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { indexPost } from "../src/lib/ai/retrieval";

async function main() {
  if (process.env.AI_ENABLED !== "true" || !process.env.OPENAI_API_KEY) throw new Error("Configure AI_ENABLED and OPENAI_API_KEY first.");
  const posts = await prisma.post.findMany({ orderBy: { id: "asc" } });
  let changed = 0;
  for (const post of posts) if (await indexPost(post)) changed++;
  console.log(`Indexed ${changed} changed questions; ${posts.length} total. Unchanged embeddings reused.`);
}
main().catch(() => { console.error("Indexing failed. Check provider configuration and database access; retry to resume."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
