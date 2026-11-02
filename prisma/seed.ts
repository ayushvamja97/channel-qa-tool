import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const adminSeedPassword = process.env.SEED_ADMIN_PASSWORD;
  const userSeedPassword = process.env.SEED_USER_PASSWORD;

  if (!adminSeedPassword || !userSeedPassword) {
    throw new Error("Seed passwords must be set in environment variables.");
  }

  const adminPassword = await bcrypt.hash(adminSeedPassword, 10);
  const userPassword = await bcrypt.hash(userSeedPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      displayName: "Admin",
      role: "admin",
    },
    create: {
      displayName: "Admin",
      email: "admin@example.com",
      passwordHash: adminPassword,
      role: "admin",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {
      displayName: "Ayush User",
      role: "user",
    },
    create: {
      displayName: "Ayush User",
      email: "user@example.com",
      passwordHash: userPassword,
      role: "user",
    },
  });

  const javascriptChannel = await prisma.channel.upsert({
    where: { name: "javascript" },
    update: {
      description: "Discuss JavaScript questions and answers.",
      createdBy: admin.id,
    },
    create: {
      name: "javascript",
      description: "Discuss JavaScript questions and answers.",
      createdBy: admin.id,
    },
  });

  const nextjsChannel = await prisma.channel.upsert({
    where: { name: "nextjs" },
    update: {
      description: "Discuss Next.js app development.",
      createdBy: admin.id,
    },
    create: {
      name: "nextjs",
      description: "Discuss Next.js app development.",
      createdBy: admin.id,
    },
  });

  await prisma.channel.upsert({
    where: { name: "docker" },
    update: {
      description: "Ask Docker and containerization questions.",
      createdBy: user.id,
    },
    create: {
      name: "docker",
      description: "Ask Docker and containerization questions.",
      createdBy: user.id,
    },
  });

  const existingClosurePost = await prisma.post.findFirst({
    where: {
      channelId: javascriptChannel.id,
      title: "How do closures work in JavaScript?",
    },
  });

  let closurePost = existingClosurePost;

  if (!closurePost) {
    closurePost = await prisma.post.create({
      data: {
        channelId: javascriptChannel.id,
        authorId: admin.id,
        title: "How do closures work in JavaScript?",
        body: "Can someone explain closures with a simple example?",
      },
    });
  }

  const existingNextPost = await prisma.post.findFirst({
    where: {
      channelId: nextjsChannel.id,
      title: "How do I fetch data in a Next.js server component?",
    },
  });

  if (!existingNextPost) {
    await prisma.post.create({
      data: {
        channelId: nextjsChannel.id,
        authorId: user.id,
        title: "How do I fetch data in a Next.js server component?",
        body: "I want to understand the basic pattern for server-side data fetching in the App Router.",
      },
    });
  }

  const existingReply = await prisma.reply.findFirst({
    where: {
      postId: closurePost.id,
      body: "A closure happens when a function remembers variables from its outer scope.",
    },
  });

  if (!existingReply) {
    await prisma.reply.create({
      data: {
        postId: closurePost.id,
        authorId: user.id,
        body: "A closure happens when a function remembers variables from its outer scope.",
      },
    });
  }

  console.log("Seed completed.");
  console.log("Demo accounts seeded successfully.");
  console.log("Channels created: javascript, nextjs, docker");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
