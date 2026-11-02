import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathParts } = await params;

    if (!pathParts || pathParts.length !== 1) {
      return new NextResponse("Not found", { status: 404 });
    }

    const fileName = pathParts[0];

    if (!/^[a-f0-9\-]+\.(png|jpg|webp)$/.test(fileName)) {
      return new NextResponse("Invalid file", { status: 400 });
    }

    const filePath = path.join(process.cwd(), "uploads", fileName);

    const fileBuffer = await readFile(filePath);

    const ext = fileName.split(".").pop();

    const mimeType =
      ext === "png"
        ? "image/png"
        : ext === "jpg"
        ? "image/jpeg"
        : ext === "webp"
        ? "image/webp"
        : "application/octet-stream";

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("GET /uploads error:", error);
    return new NextResponse("File not found", { status: 404 });
  }
}