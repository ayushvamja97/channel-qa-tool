import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { demoContent } from "./demo-content";
import { createHash } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

async function main() {
  if (process.env.SEED_DEMO_DATA !== "true") throw new Error("Set SEED_DEMO_DATA=true explicitly for a disposable demo database.");
  if (!process.env.SEED_USER_PASSWORD) throw new Error("SEED_USER_PASSWORD is required.");
  const passwordHash = await bcrypt.hash(process.env.SEED_USER_PASSWORD, 10);
  const users: { id: number }[] = [];
  for (let i = 1; i <= 18; i++) {
    users.push(await prisma.user.upsert({ where: { email: `demo${i}@example.com` }, update: {}, create: { email: `demo${i}@example.com`, displayName: `Demo Developer ${String(i).padStart(2, "0")}`, passwordHash, role: "user" } }));
  }
  let count = 0;
  for (const [name, questions] of Object.entries(demoContent)) {
    const channel = await prisma.channel.upsert({ where: { name }, update: {}, create: { name, description: `Fictional demo discussions about ${name}.`, createdBy: users[count % users.length].id } });
    for (let i = 0; i < questions.length; i++) {
      const [title, body, answer] = questions[i], demoKey = `demo-v1:${name}:${i}`;
      const author = users[count % users.length], responder = users[(count + 3) % users.length];
      await prisma.$transaction(async tx => {
        const post = await tx.post.upsert({ where: { demoKey }, update: {}, create: { demoKey, channelId: channel.id, authorId: author.id, title, body, createdAt: new Date(Date.UTC(2026, 9, 1 + count % 28, count % 24)) } });
        const reply = await tx.reply.upsert({ where: { demoKey: `${demoKey}:answer` }, update: {}, create: { demoKey: `${demoKey}:answer`, postId: post.id, authorId: responder.id, body: answer } });
        await tx.reply.upsert({ where: { demoKey: `${demoKey}:followup` }, update: {}, create: { demoKey: `${demoKey}:followup`, postId: post.id, parentReplyId: reply.id, authorId: author.id, body: "Thanks for explaining the tradeoff. I will test this approach with the smallest reproducible example before applying it to the rest of my project. (Fictional demo reply.)" } });
        await tx.reply.upsert({ where: { demoKey: `${demoKey}:testing` }, update: {}, create: { demoKey: `${demoKey}:testing`, postId: post.id, authorId: users[(count + 7) % users.length].id, body: "For a regression check, cover the original failing example and an edge case. Record expected and actual behavior so the result is reproducible. (Fictional demo reply.)" } });
        for (let j = 0; j < 3 + count % 5; j++) {
          const userId = users[(count + j + 1) % users.length].id;
          await tx.vote.upsert({ where: { userId_postId: { userId, postId: post.id } }, update: {}, create: { userId, postId: post.id, value: j === 0 && count % 4 === 0 ? -1 : 1 } });
          await tx.vote.upsert({ where: { userId_replyId: { userId, replyId: reply.id } }, update: {}, create: { userId, replyId: reply.id, value: 1 } });
        }
      });
      if (i === 0 && ["python", "javascript", "react", "sql", "docker", "ai-ml"].includes(name)) {
        const hex = createHash("sha256").update(`channel-qa-demo-${name}`).digest("hex");
        const filename = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}.png`;
        const source = path.join(process.cwd(), "prisma", "demo-images", filename);
        await mkdir(path.join(process.cwd(), "uploads"), { recursive: true });
        await copyFile(source, path.join(process.cwd(), "uploads", filename));
        const post = await prisma.post.findUniqueOrThrow({ where: { demoKey } });
        const existing = await prisma.attachment.findFirst({ where: { postId: post.id, path: filename } });
        if (!existing) await prisma.attachment.create({ data: { postId: post.id, path: filename, mimeType: "image/png", sizeBytes: (await stat(source)).size } });
      }
      count++;
    }
  }
  console.log(`Demo seed ready: ${count} questions, ${count * 3} replies, 18 fictional additional users, six synthetic images. Existing discussion records/passwords preserved.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Demo seed failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
