import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET() {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    return NextResponse.json(channels);
  } catch (error) {
    console.error("GET /api/channels error:", error);
    return NextResponse.json(
      { error: "Failed to fetch channels." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    const user = token ? verifyToken(token) : null;

    const contentType = request.headers.get("content-type") || "";

    let name = "";
    let description: string | null = null;
    let isFormSubmission = false;

    if (contentType.includes("application/json")) {
      const body = await request.json();

      name = typeof body.name === "string" ? body.name : "";
      description =
        typeof body.description === "string" ? body.description : null;
    } else {
      const formData = await request.formData();
      isFormSubmission = true;

      const rawName = formData.get("name");
      const rawDescription = formData.get("description");

      name = typeof rawName === "string" ? rawName : "";
      description = typeof rawDescription === "string" ? rawDescription : null;
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

    const trimmedName = name.trim();
    const trimmedDescription = description?.trim() || null;

    if (trimmedName.length < 2) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/channels", request.url), 303);
      }

      return NextResponse.json(
        { error: "Channel name must be at least 2 characters." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!existingUser) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/login", request.url), 303);
      }

      return NextResponse.json(
        { error: "Creator user not found." },
        { status: 404 }
      );
    }

    const channel = await prisma.channel.create({
      data: {
        name: trimmedName.toLowerCase(),
        description: trimmedDescription,
        createdBy: user.userId,
      },
    });

    if (isFormSubmission) {
      return NextResponse.redirect(new URL("/channels", request.url), 303);
    }

    return NextResponse.json(channel, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/channels error:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      if (
        (request.headers.get("content-type") || "").includes("multipart/form-data") ||
        (request.headers.get("content-type") || "").includes("application/x-www-form-urlencoded")
      ) {
        return NextResponse.redirect(new URL("/channels", request.url), 303);
      }

      return NextResponse.json(
        { error: "Channel name already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create channel." },
      { status: 500 }
    );
  }
}