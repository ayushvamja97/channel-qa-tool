import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    const user = token ? verifyToken(token) : null;

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url), 303);
    }

    const formData = await request.formData();

    const file = formData.get("file");
    const targetType = formData.get("targetType");
    const targetIdRaw = formData.get("targetId");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A file is required." },
        { status: 400 }
      );
    }

    if (
      typeof targetType !== "string" ||
      (targetType !== "post" && targetType !== "reply")
    ) {
      return NextResponse.json(
        { error: "targetType must be 'post' or 'reply'." },
        { status: 400 }
      );
    }

    const targetId =
      typeof targetIdRaw === "string" ? Number(targetIdRaw) : NaN;

    if (Number.isNaN(targetId) || targetId <= 0) {
      return NextResponse.json(
        { error: "Valid targetId is required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPG/JPEG, and WebP files are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File size must be 5 MB or less." },
        { status: 400 }
      );
    }

    let postIdForRedirect: number;

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

      postIdForRedirect = existingPost.id;
    } else {
      const existingReply = await prisma.reply.findUnique({
        where: { id: targetId },
      });

      if (!existingReply) {
        return NextResponse.json(
          { error: "Reply not found." },
          { status: 404 }
        );
      }

      postIdForRedirect = existingReply.postId;
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const extension = ALLOWED_EXTENSIONS[file.type] || ".bin";
    const generatedFileName = `${randomUUID()}${extension}`;
    const absoluteFilePath = path.join(uploadsDir, generatedFileName);

    await writeFile(absoluteFilePath, buffer);

    await prisma.attachment.create({
      data:
        targetType === "post"
          ? {
              postId: targetId,
              mimeType: file.type,
              sizeBytes: file.size,
              path: generatedFileName,
            }
          : {
              replyId: targetId,
              mimeType: file.type,
              sizeBytes: file.size,
              path: generatedFileName,
            },
    });

    return NextResponse.redirect(
      new URL(`/posts/${postIdForRedirect}`, request.url),
      303
    );
  } catch (error) {
    console.error("POST /api/uploads error:", error);

    return NextResponse.json(
      { error: "Failed to upload screenshot." },
      { status: 500 }
    );
  }
}