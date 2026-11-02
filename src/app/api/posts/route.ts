import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    const user = token ? verifyToken(token) : null;

    const contentType = request.headers.get("content-type") || "";

    let title = "";
    let body = "";
    let channelId: number | null = null;
    let isFormSubmission = false;

    if (contentType.includes("application/json")) {
      const requestBody = await request.json();

      title = typeof requestBody.title === "string" ? requestBody.title : "";
      body = typeof requestBody.body === "string" ? requestBody.body : "";
      channelId =
        typeof requestBody.channelId === "number"
          ? requestBody.channelId
          : Number(requestBody.channelId);
    } else {
      const formData = await request.formData();
      isFormSubmission = true;

      const rawTitle = formData.get("title");
      const rawBody = formData.get("body");
      const rawChannelId = formData.get("channelId");

      title = typeof rawTitle === "string" ? rawTitle : "";
      body = typeof rawBody === "string" ? rawBody : "";
      channelId =
        typeof rawChannelId === "string" ? Number(rawChannelId) : null;
    }

    if (!user) {
      if (isFormSubmission && channelId) {
        return NextResponse.redirect(
          new URL("/login", request.url),
          303
        );
      }

      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (!title || title.trim().length < 3) {
      if (isFormSubmission && channelId) {
        return NextResponse.redirect(
          new URL(`/channels/${channelId}`, request.url),
          303
        );
      }

      return NextResponse.json(
        { error: "Post title must be at least 3 characters." },
        { status: 400 }
      );
    }

    if (!body || body.trim().length < 5) {
      if (isFormSubmission && channelId) {
        return NextResponse.redirect(
          new URL(`/channels/${channelId}`, request.url),
          303
        );
      }

      return NextResponse.json(
        { error: "Post body must be at least 5 characters." },
        { status: 400 }
      );
    }

    if (!channelId || Number.isNaN(channelId)) {
      return NextResponse.json(
        { error: "Valid channelId is required." },
        { status: 400 }
      );
    }

    const existingChannel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!existingChannel) {
      return NextResponse.json(
        { error: "Channel not found." },
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

    const post = await prisma.post.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        channelId,
        authorId: user.userId,
      },
    });

    if (isFormSubmission) {
      return NextResponse.redirect(
        new URL(`/channels/${channelId}`, request.url),
        303
      );
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("POST /api/posts error:", error);

    return NextResponse.json(
      { error: "Failed to create post." },
      { status: 500 }
    );
  }
}