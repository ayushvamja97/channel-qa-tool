import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    const user = token ? verifyToken(token) : null;

    const contentType = request.headers.get("content-type") || "";

    let body = "";
    let postId: number | null = null;
    let parentReplyId: number | null = null;
    let isFormSubmission = false;

    if (contentType.includes("application/json")) {
      const requestBody = await request.json();

      body = typeof requestBody.body === "string" ? requestBody.body : "";
      postId =
        typeof requestBody.postId === "number"
          ? requestBody.postId
          : Number(requestBody.postId);
      parentReplyId =
        requestBody.parentReplyId === null ||
        requestBody.parentReplyId === undefined ||
        requestBody.parentReplyId === ""
          ? null
          : typeof requestBody.parentReplyId === "number"
            ? requestBody.parentReplyId
            : Number(requestBody.parentReplyId);
    } else {
      const formData = await request.formData();
      isFormSubmission = true;

      const rawBody = formData.get("body");
      const rawPostId = formData.get("postId");
      const rawParentReplyId = formData.get("parentReplyId");

      body = typeof rawBody === "string" ? rawBody : "";
      postId = typeof rawPostId === "string" ? Number(rawPostId) : null;
      parentReplyId =
        typeof rawParentReplyId === "string" && rawParentReplyId.trim() !== ""
          ? Number(rawParentReplyId)
          : null;
    }

    if (!user) {
      if (isFormSubmission && postId) {
        return NextResponse.redirect(new URL("/login", request.url), 303);
      }

      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const trimmedBody = body.trim();

    if (trimmedBody.length < 2 || trimmedBody.length > 10000) {
      if (isFormSubmission && postId) {
        return NextResponse.redirect(
          new URL(`/posts/${postId}`, request.url),
          303
        );
      }

      return NextResponse.json(
        { error: "Reply body must be 2–10,000 characters." },
        { status: 400 }
      );
    }

    if (!postId || Number.isNaN(postId)) {
      return NextResponse.json(
        { error: "Valid postId is required." },
        { status: 400 }
      );
    }

    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: "Post not found." },
        { status: 404 }
      );
    }

    const existingAuthor = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!existingAuthor) {
      return NextResponse.json(
        { error: "Author not found." },
        { status: 404 }
      );
    }

    if (parentReplyId !== null) {
      if (Number.isNaN(parentReplyId)) {
        return NextResponse.json(
          { error: "Invalid parentReplyId." },
          { status: 400 }
        );
      }

      const existingParentReply = await prisma.reply.findUnique({
        where: { id: parentReplyId },
      });

      if (!existingParentReply || existingParentReply.postId !== postId) {
        return NextResponse.json(
          { error: "Parent reply not found for this post." },
          { status: 404 }
        );
      }
    }

    const reply = await prisma.reply.create({
      data: {
        body: trimmedBody,
        postId,
        parentReplyId,
        authorId: user.userId,
      },
    });

    if (isFormSubmission) {
      return NextResponse.redirect(
        new URL(`/posts/${postId}`, request.url),
        303
      );
    }

    return NextResponse.json(reply, { status: 201 });
  } catch (error) {
    console.error("POST /api/replies error:", error);

    return NextResponse.json(
      { error: "Failed to create reply." },
      { status: 500 }
    );
  }
}
