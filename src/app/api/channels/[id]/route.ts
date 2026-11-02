import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const channelId = Number(id);

    if (Number.isNaN(channelId)) {
      return NextResponse.json(
        { error: "Invalid channel id." },
        { status: 400 }
      );
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        creator: {
          select: {
            id: true,
            displayName: true,
          },
        },
        posts: {
          orderBy: { createdAt: "desc" },
          include: {
            author: {
              select: {
                displayName: true,
              },
            },
            _count: {
              select: {
                replies: true,
                votes: true,
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(channel);
  } catch (error) {
    console.error("GET /api/channels/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel." },
      { status: 500 }
    );
  }
}