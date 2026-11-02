import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { similarQuestions } from "../src/lib/ai/retrieval";

// Small explicit relevance set; smoke evaluation, not a broad benchmark.
const cases = [
  ["Repeating a nested array in Python makes all rows change together", "demo-v1:python:0"],
  ["My async JavaScript call prints Promise instead of the actual result", "demo-v1:javascript:0"],
  ["Can I expose my provider secret using a public Next.js environment variable?", "demo-v1:nextjs:0"],
  ["I cannot remove a SQL channel because child records reference it", "demo-v1:sql:2"],
  ["Images disappear when my app container is recreated", "demo-v1:docker:1"],
  ["Does a pretrained ImageNet network know code editor screenshot categories?", "demo-v1:ai-ml:1"],
];
async function main() {
  let top1 = 0, top5 = 0;
  for (const [query, demoKey] of cases) {
    const expected = await prisma.post.findUnique({ where: { demoKey }, select: { id: true } });
    if (!expected) throw new Error("Run the demo seed and index before evaluation.");
    const results = await similarQuestions(query);
    const rank = results.findIndex(result => result.id === expected.id);
    if (rank === 0) top1++; if (rank >= 0) top5++;
    console.log(JSON.stringify({ query, expectedPostId: expected.id, rank: rank >= 0 ? rank + 1 : null }));
  }
  console.log(JSON.stringify({ cases: cases.length, top1: top1 / cases.length, recallAt5: top5 / cases.length, note: "Six hand-authored cases only. Not a general relevance or accuracy claim." }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Evaluation failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
