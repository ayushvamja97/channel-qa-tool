import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    const user = token ? verifyToken(token) : null;

    const contentType = request.headers.get("content-type") || "";

    let targetType = "";
    let targetId: number | null = null;
    let value: number | null = null;
    let isFormSubmission = false;

    if (contentType.includes("application/json")) {
      const body = await request.json();

      targetType = typeof body.targetType === "string" ? body.targetType : "";
      targetId =
        typeof body.targetId === "number"
          ? body.targetId
          : Number(body.targetId);
      value = typeof body.value === "number" ? body.value : Number(body.value);
    } else {
      const formData = await request.formData();
      isFormSubmission = true;

      const rawTargetType = formData.get("targetType");
      const rawTargetId = formData.get("targetId");
      const rawValue = formData.get("value");

      targetType = typeof rawTargetType === "string" ? rawTargetType : "";
      targetId = typeof rawTargetId === "string" ? Number(rawTargetId) : null;
      value = typeof rawValue === "string" ? Number(rawValue) : null;
    }

    if (!user) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/login", request.url), 303);
      }

      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (targetType !== "post" && targetType !== "reply") {
      return NextResponse.json(
        { error: "targetType must be 'post' or 'reply'." },
        { status: 400 }
      );
    }

    if (!targetId || Number.isNaN(targetId)) {
      return NextResponse.json(
        { error: "Valid targetId is required." },
        { status: 400 }
      );
    }

    if (value !== 1 && value !== -1) {
      return NextResponse.json(
        { error: "Vote value must be 1 or -1." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    if (targetType === "post") {
      const existingPost = await prisma.post.findUnique({
        where: { id: targetId },
      });

      if (!existingPost) {
        return NextResponse.json(
          { error: "Post not found." },
          { status: 404 }
        );
      }

      const existingVote = await prisma.vote.findFirst({
        where: {
          userId: user.userId,
          postId: targetId,
        },
      });

      if (!existingVote) {
        await prisma.vote.create({
          data: {
            userId: user.userId,
            postId: targetId,
            value,
          },
        });
      } else if (existingVote.value === value) {
        await prisma.vote.delete({
          where: {
            id: existingVote.id,
          },
        });
      } else {
        await prisma.vote.update({
          where: {
            id: existingVote.id,
          },
          data: {
            value,
          },
        });
      }

      if (isFormSubmission) {
        return NextResponse.redirect(
          new URL(`/posts/${targetId}`, request.url),
          303
        );
      }

      return NextResponse.json({ success: true });
    }

    const existingReply = await prisma.reply.findUnique({
      where: { id: targetId },
    });

    if (!existingReply) {
      return NextResponse.json(
        { error: "Reply not found." },
        { status: 404 }
      );
    }

    const existingVote = await prisma.vote.findFirst({
      where: {
        userId: user.userId,
        replyId: targetId,
      },
    });

    if (!existingVote) {
      await prisma.vote.create({
        data: {
          userId: user.userId,
          replyId: targetId,
          value,
        },
      });
    } else if (existingVote.value === value) {
      await prisma.vote.delete({
        where: {
          id: existingVote.id,
        },
      });
    } else {
      await prisma.vote.update({
        where: {
          id: existingVote.id,
        },
        data: {
          value,
        },
      });
    }

    if (isFormSubmission) {
      return NextResponse.redirect(
        new URL(`/posts/${existingReply.postId}`, request.url),
        303
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/votes error:", error);

    return NextResponse.json(
      { error: "Failed to process vote." },
      { status: 500 }
    );
  }
}