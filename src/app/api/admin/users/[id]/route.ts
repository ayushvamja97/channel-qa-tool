import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

async function ensureAdmin(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const user = token ? verifyToken(token) : null;

  if (!user) {
    return {
      error: NextResponse.redirect(new URL("/login", request.url), 303),
    };
  }

  if (user.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { user };
}

function collectReplySubtreeIds(
  startingReplyIds: number[],
  allReplies: Array<{ id: number; parentReplyId: number | null }>
) {
  const childrenMap = new Map<number, number[]>();

  for (const reply of allReplies) {
    if (reply.parentReplyId !== null) {
      const existing = childrenMap.get(reply.parentReplyId) || [];
      existing.push(reply.id);
      childrenMap.set(reply.parentReplyId, existing);
    }
  }

  const result = new Set<number>();
  const stack = [...startingReplyIds];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (result.has(current)) continue;

    result.add(current);

    const children = childrenMap.get(current) || [];
    for (const childId of children) {
      stack.push(childId);
    }
  }

  return Array.from(result);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await ensureAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const formData = await request.formData();
    const method = formData.get("_method");

    if (method !== "DELETE") {
      return NextResponse.json({ error: "Invalid method." }, { status: 400 });
    }

    const { id } = await params;
    const userId = Number(id);

    if (Number.isNaN(userId)) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    if (userId === auth.user.userId) {
      return NextResponse.json(
        { error: "Admin cannot delete themselves." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.redirect(new URL("/admin", request.url), 303);
    }

    await prisma.$transaction(async (tx) => {
      // Reassign channels created by this user to the current admin
      await tx.channel.updateMany({
        where: { createdBy: userId },
        data: { createdBy: auth.user.userId },
      });

      // Delete this user's direct votes first
      await tx.vote.deleteMany({
        where: { userId },
      });

      // Delete posts authored by this user, including all dependent replies/votes/attachments
      const authoredPosts = await tx.post.findMany({
        where: { authorId: userId },
        select: { id: true },
      });

      const authoredPostIds = authoredPosts.map((post) => post.id);

      if (authoredPostIds.length > 0) {
        const repliesOnAuthoredPosts = await tx.reply.findMany({
          where: { postId: { in: authoredPostIds } },
          select: { id: true },
        });

        const replyIdsOnAuthoredPosts = repliesOnAuthoredPosts.map((r) => r.id);

        if (replyIdsOnAuthoredPosts.length > 0) {
          await tx.vote.deleteMany({
            where: { replyId: { in: replyIdsOnAuthoredPosts } },
          });

          await tx.attachment.deleteMany({
            where: { replyId: { in: replyIdsOnAuthoredPosts } },
          });

          await tx.reply.deleteMany({
            where: { id: { in: replyIdsOnAuthoredPosts } },
          });
        }

        await tx.vote.deleteMany({
          where: { postId: { in: authoredPostIds } },
        });

        await tx.attachment.deleteMany({
          where: { postId: { in: authoredPostIds } },
        });

        await tx.post.deleteMany({
          where: { id: { in: authoredPostIds } },
        });
      }

      // Delete reply subtrees authored by this user in remaining posts
      const allReplies = await tx.reply.findMany({
        select: {
          id: true,
          parentReplyId: true,
          authorId: true,
        },
      });

      const rootReplyIds = allReplies
        .filter((reply) => reply.authorId === userId)
        .map((reply) => reply.id);

      const replySubtreeIds = collectReplySubtreeIds(rootReplyIds, allReplies);

      if (replySubtreeIds.length > 0) {
        await tx.vote.deleteMany({
          where: { replyId: { in: replySubtreeIds } },
        });

        await tx.attachment.deleteMany({
          where: { replyId: { in: replySubtreeIds } },
        });

        await tx.reply.deleteMany({
          where: { id: { in: replySubtreeIds } },
        });
      }

      // Finally delete the user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return NextResponse.redirect(new URL("/admin", request.url), 303);
  } catch (error) {
    console.error("POST /api/admin/users/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to remove user." },
      { status: 500 }
    );
  }
}