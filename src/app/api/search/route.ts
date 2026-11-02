import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const type = (searchParams.get("type") || "substring").trim();
    const q = (searchParams.get("q") || "").trim();
    const author = (searchParams.get("author") || "").trim();
    const channelIdRaw = (searchParams.get("channelId") || "").trim();
    const pageRaw = searchParams.get("page") || "1";
    const page = Math.max(1, Number(pageRaw) || 1);
    const skip = (page - 1) * PAGE_SIZE;

    const channelId =
      channelIdRaw !== "" && !Number.isNaN(Number(channelIdRaw))
        ? Number(channelIdRaw)
        : null;

    if (type === "substring") {
      const whereClause = {
        OR: [
          {
            title: {
              contains: q,
            },
          },
          {
            body: {
              contains: q,
            },
          },
          {
            replies: {
              some: {
                body: {
                  contains: q,
                },
              },
            },
          },
        ],
        ...(channelId ? { channelId } : {}),
      };

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: PAGE_SIZE,
          include: {
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
            author: {
              select: {
                id: true,
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
        }),
        prisma.post.count({
          where: whereClause,
        }),
      ]);

      return NextResponse.json({
        type,
        page,
        pageSize: PAGE_SIZE,
        total,
        hasMore: skip + posts.length < total,
        results: posts,
      });
    }

    if (type === "author") {
      if (!author) {
        return NextResponse.json(
          { error: "author is required for author search." },
          { status: 400 }
        );
      }

      const [posts, total] = await Promise.all([
        prisma.post.findMany({
          where: {
            author: {
              displayName: {
                contains: author,
              },
            },
            ...(channelId ? { channelId } : {}),
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: PAGE_SIZE,
          include: {
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
            author: {
              select: {
                id: true,
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
        }),
        prisma.post.count({
          where: {
            author: {
              displayName: {
                contains: author,
              },
            },
            ...(channelId ? { channelId } : {}),
          },
        }),
      ]);

      return NextResponse.json({
        type,
        page,
        pageSize: PAGE_SIZE,
        total,
        hasMore: skip + posts.length < total,
        results: posts,
      });
    }

    if (type === "most-posts" || type === "least-posts") {
      const users = await prisma.user.findMany({
        include: {
          _count: {
            select: {
              posts: true,
            },
          },
        },
        orderBy: {
          posts: {
            _count: type === "most-posts" ? "desc" : "asc",
          },
        },
        skip,
        take: PAGE_SIZE,
      });

      const total = await prisma.user.count();

      return NextResponse.json({
        type,
        page,
        pageSize: PAGE_SIZE,
        total,
        hasMore: skip + users.length < total,
        results: users.map((user) => ({
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          postCount: user._count.posts,
          role: user.role,
        })),
      });
    }

    if (type === "highest-ranked" || type === "lowest-ranked") {
      const posts = await prisma.post.findMany({
        include: {
          channel: {
            select: {
              id: true,
              name: true,
            },
          },
          author: {
            select: {
              id: true,
              displayName: true,
            },
          },
          votes: {
            select: {
              value: true,
            },
          },
          _count: {
            select: {
              replies: true,
              votes: true,
            },
          },
        },
      });

      const scoredPosts = posts.map((post) => ({
        id: post.id,
        title: post.title,
        body: post.body,
        createdAt: post.createdAt,
        channel: post.channel,
        author: post.author,
        _count: post._count,
        voteScore: post.votes.reduce((sum, vote) => sum + vote.value, 0),
      }));

      scoredPosts.sort((a, b) =>
        type === "highest-ranked"
          ? b.voteScore - a.voteScore
          : a.voteScore - b.voteScore
      );

      const pagedResults = scoredPosts.slice(skip, skip + PAGE_SIZE);

      return NextResponse.json({
        type,
        page,
        pageSize: PAGE_SIZE,
        total: scoredPosts.length,
        hasMore: skip + pagedResults.length < scoredPosts.length,
        results: pagedResults,
      });
    }

    return NextResponse.json(
      { error: "Invalid search type." },
      { status: 400 }
    );
  } catch (error) {
    console.error("GET /api/search error:", error);

    return NextResponse.json(
      { error: "Failed to search." },
      { status: 500 }
    );
  }
}