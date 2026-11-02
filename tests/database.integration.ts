import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { signToken } from "../src/lib/auth/jwt";
import { POST as question } from "../src/app/api/ai/question/route";
import { POST as summarize } from "../src/app/api/ai/summary/route";
import { POST as image } from "../src/app/api/ai/image/route";
import { POST as createPost } from "../src/app/api/posts/route";
import { POST as createReply } from "../src/app/api/replies/route";
import { POST as vote } from "../src/app/api/votes/route";
import { similarQuestions, postText, contentHash } from "../src/lib/ai/retrieval";

async function main() {
  const url = new URL(process.env.DATABASE_URL || "mysql://invalid");
  if (!url.pathname.endsWith("_test") || process.env.ALLOW_TEST_DATABASE !== "true") throw new Error("Use a fresh disposable database ending in _test and set ALLOW_TEST_DATABASE=true.");
  process.env.JWT_SECRET = "synthetic-integration-only-secret-32-characters";
  process.env.SEED_ADMIN_PASSWORD = "synthetic-admin-test";
  process.env.SEED_USER_PASSWORD = "synthetic-user-test";
  process.env.SEED_DEMO_DATA = "true";
  const run = (args: string[]) => execFileSync(process.execPath, args, { stdio: "pipe", env: process.env });
  run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  run(["--import", "tsx", "prisma/seed.ts"]);
  run(["--import", "tsx", "prisma/demo.ts"]);
  const counts = async () => Promise.all([prisma.user.count(), prisma.channel.count(), prisma.post.count(), prisma.reply.count(), prisma.vote.count()]);
  const before = await counts();
  assert.deepEqual(before, [20, 10, 62, 181, 600]);
  assert.equal(await prisma.attachment.count(), 6);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "demo1@example.com" } });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: "synthetic-preserved-hash-marker" } });
  run(["--import", "tsx", "prisma/seed.ts"]);
  run(["--import", "tsx", "prisma/demo.ts"]);
  assert.deepEqual(await counts(), before);
  assert.equal(await prisma.attachment.count(), 6);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, "synthetic-preserved-hash-marker");
  console.log("PASS migrations, exact fixture counts, repeat seeding, password preservation");
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  const req = (path: string, body: unknown) => new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers: { "Content-Type": "application/json", origin: "http://localhost:3000", cookie: `auth_token=${token}` }, body: JSON.stringify(body) });
  const post = await prisma.post.findUniqueOrThrow({ where: { demoKey: "demo-v1:python:0" } });
  const channel = await prisma.channel.findUniqueOrThrow({ where: { name: "testing" } });
  const created = await createPost(req("/api/posts", { channelId: channel.id, title: "Integration smoke question", body: "A valid question created without any AI provider." }));
  assert.equal(created.status, 201);
  const createdPost = await created.json();
  const reply = await createReply(req("/api/replies", { postId: createdPost.id, body: "Try a small reproducible example." }));
  assert.equal(reply.status, 201);
  const createdReply = await reply.json();
  assert.equal((await createReply(req("/api/replies", { postId: post.id, parentReplyId: createdReply.id, body: "Wrong post parent" }))).status, 404);
  for (const value of [1, 1, -1]) assert.equal((await vote(req("/api/votes", { targetType: "post", targetId: createdPost.id, value }))).status, 200);
  assert.equal((await prisma.vote.findUniqueOrThrow({ where: { userId_postId: { userId: user.id, postId: createdPost.id } } })).value, -1);
  console.log("PASS normal posting, replies, parent ownership and vote toggling with real database");
  process.env.AI_ENABLED = "false";
  assert.equal((await question(req("/api/ai/question", { action: "review", title: "Sample draft", body: "Enough context for review." }))).status, 503);
  const originalFetch = globalThis.fetch;
  process.env.AI_ENABLED = "true"; process.env.OPENAI_API_KEY = "synthetic-provider-key";
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options?.body as string);
    if (String(url).endsWith("embeddings")) return Response.json({ data: [{ embedding: [1, ...Array(511).fill(0)] }] });
    const isSummary = body.text.format.name === "discussion_summary";
    const replies = isSummary ? JSON.parse(body.input).replies : [];
    const result = isSummary ? { overview: "A fictional discussion", points: [{ text: "Use separate inner lists.", replyIds: [replies[0].id] }], unresolved: [] } : { title: "Clearer title", body: "Preserved question body", missingDetails: ["Python version"] };
    return Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(result) }] }] });
  };
  try {
    assert.equal((await question(req("/api/ai/question", { action: "review", title: "Sample draft", body: "Enough context for review." }))).status, 200);
    const vector = [1, ...Array(511).fill(0)];
    await prisma.postEmbedding.create({ data: { postId: post.id, model: "text-embedding-3-small", contentHash: contentHash(postText(post)), vector } });
    assert.equal((await similarQuestions("nested Python list references"))[0].id, post.id);
    const summary = await summarize(req("/api/ai/summary", { postId: post.id }));
    assert.equal(summary.status, 200);
    const data = await summary.json();
    assert.ok(data.summary.points[0].replyIds.length);
    // No vision URL/token: analysis returns a controlled failure without removing the file/record.
    const unavailable = await image(req("/api/ai/image", { attachmentId: 99999999 }));
    assert.equal(unavailable.status, 404);
    console.log("PASS authenticated AI handlers, disabled-provider fallback, persisted retrieval and summary citations (provider mocked)");
  } finally { globalThis.fetch = originalFetch; }
  if (process.env.VISION_SERVICE_URL && process.env.VISION_SERVICE_TOKEN) {
    const other = await prisma.user.findUniqueOrThrow({ where: { email: "demo2@example.com" } });
    const otherToken = signToken({ userId: other.id, email: other.email, role: other.role });
    const attachments = await prisma.attachment.findMany({ orderBy: { id: "asc" }, take: 2 });
    for (const attachment of attachments) {
      const request = req("/api/ai/image", { attachmentId: attachment.id });
      request.cookies.set("auth_token", otherToken);
      const response = await image(request);
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    }
    assert.equal(await prisma.imageAnalysis.count(), 2);
    console.log("PASS real CNN HTTP inference through authenticated Next.js handler and persisted image vectors");
  } else console.log("SKIP real CNN HTTP integration (set VISION_SERVICE_URL and VISION_SERVICE_TOKEN to enable)");
  // The database is disposable. Leave seeded fixtures for optional manual inspection.
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
