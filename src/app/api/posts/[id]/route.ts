import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const postId = Number(id);

    if (Number.isNaN(postId)) {
      return NextResponse.json(
        { error: "Invalid post id." },
        { status: 400 }
      );
    }

    const token = request.cookies.get("auth_token")?.value;
    const user = token ? verifyToken(token) : null;
    const currentUserId = user?.userId ?? null;

    const post = await prisma.post.findUnique({
      where: { id: postId },
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
            userId: true,
          },
        },
        attachments: {
          select: {
            id: true,
            path: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
              },
            },
            votes: {
              select: {
                value: true,
                userId: true,
              },
            },
            attachments: {
              select: {
                id: true,
                path: true,
                mimeType: true,
                sizeBytes: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post not found." },
        { status: 404 }
      );
    }

    const postVoteScore = post.votes.reduce((sum, vote) => sum + vote.value, 0);
    const postUpvoteCount = post.votes.filter((vote) => vote.value === 1).length;
    const postDownvoteCount = post.votes.filter((vote) => vote.value === -1).length;
    const postCurrentUserVote =
      currentUserId !== null
        ? post.votes.find((vote) => vote.userId === currentUserId)?.value ?? 0
        : 0;

    const transformedPost = {
      id: post.id,
      title: post.title,
      body: post.body,
      createdAt: post.createdAt,
      channel: post.channel,
      author: post.author,
      _count: {
        votes: post.votes.length,
      },
      voteScore: postVoteScore,
      upvoteCount: postUpvoteCount,
      downvoteCount: postDownvoteCount,
      currentUserVote: postCurrentUserVote,
      attachments: post.attachments.map((attachment) => ({
        id: attachment.id,
        path: attachment.path,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        createdAt: attachment.createdAt,
        url: `/uploads/${attachment.path}`,
      })),
      replies: post.replies.map((reply) => {
        const replyVoteScore = reply.votes.reduce(
          (sum, vote) => sum + vote.value,
          0
        );
        const replyUpvoteCount = reply.votes.filter(
          (vote) => vote.value === 1
        ).length;
        const replyDownvoteCount = reply.votes.filter(
          (vote) => vote.value === -1
        ).length;
        const replyCurrentUserVote =
          currentUserId !== null
            ? reply.votes.find((vote) => vote.userId === currentUserId)?.value ?? 0
            : 0;

        return {
          id: reply.id,
          body: reply.body,
          createdAt: reply.createdAt,
          parentReplyId: reply.parentReplyId,
          author: reply.author,
          _count: {
            votes: reply.votes.length,
          },
          voteScore: replyVoteScore,
          upvoteCount: replyUpvoteCount,
          downvoteCount: replyDownvoteCount,
          currentUserVote: replyCurrentUserVote,
          attachments: reply.attachments.map((attachment) => ({
            id: attachment.id,
            path: attachment.path,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            createdAt: attachment.createdAt,
            url: `/uploads/${attachment.path}`,
          })),
        };
      }),
    };

    return NextResponse.json(transformedPost);
  } catch (error) {
    console.error("GET /api/posts/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch post." },
      { status: 500 }
    );
  }
}