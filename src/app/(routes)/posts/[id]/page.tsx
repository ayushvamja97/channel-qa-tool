import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";

type Attachment = {
  id: number;
  url: string;
};

type Reply = {
  id: number;
  body: string;
  createdAt: string;
  parentReplyId: number | null;
  author: {
    id: number;
    displayName: string;
  };
  _count: {
    votes: number;
  };
  voteScore?: number;
  attachments?: Attachment[];
};

type PostDetails = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  channel: {
    id: number;
    name: string;
  };
  author: {
    id: number;
    displayName: string;
  };
  _count: {
    votes: number;
  };
  voteScore?: number;
  attachments?: Attachment[];
  replies: Reply[];
};

async function getPost(id: string): Promise<PostDetails> {
  const res = await fetch(`http://localhost:3000/api/posts/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch post");
  }

  return res.json();
}

function VoteButtons({
  targetType,
  targetId,
  userId,
}: {
  targetType: "post" | "reply";
  targetId: number;
  userId: number | null;
}) {
  if (!userId) {
    return <p className="mt-2 text-sm text-slate-500">Login to vote</p>;
  }

  return (
    <form
      action="/api/votes"
      method="POST"
      className="mt-2 flex items-center gap-2"
    >
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />

      <button
        name="value"
        value="1"
        className="rounded bg-green-600 px-2 py-1"
      >
        ↑
      </button>
      <button
        name="value"
        value="-1"
        className="rounded bg-red-600 px-2 py-1"
      >
        ↓
      </button>
    </form>
  );
}

function Images({ attachments }: { attachments?: Attachment[] }) {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {attachments.map((img) => (
        <img
          key={img.id}
          src={img.url}
          alt="attachment"
          className="max-h-60 rounded border border-slate-700"
        />
      ))}
    </div>
  );
}

function ReplyUploadForm({
  replyId,
  userId,
}: {
  replyId: number;
  userId: number | null;
}) {
  if (!userId) {
    return null;
  }

  return (
    <form
      action="/api/uploads"
      method="POST"
      encType="multipart/form-data"
      className="mt-3"
    >
      <input
        type="file"
        name="file"
        accept="image/png,image/jpeg,image/webp"
        required
        className="block w-full text-sm"
      />
      <input type="hidden" name="targetType" value="reply" />
      <input type="hidden" name="targetId" value={replyId} />

      <button className="mt-2 rounded bg-purple-600 px-3 py-1 text-sm">
        Upload Reply Image
      </button>
    </form>
  );
}

function ReplyCard({
  reply,
  allReplies,
  postId,
  userId,
  level = 0,
}: {
  reply: Reply;
  allReplies: Reply[];
  postId: number;
  userId: number | null;
  level?: number;
}) {
  const childReplies = allReplies.filter(
    (childReply) => childReply.parentReplyId === reply.id
  );

  return (
    <div className={level > 0 ? "ml-6 mt-4 border-l border-slate-700 pl-4" : ""}>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-slate-200">{reply.body}</p>

        <Images attachments={reply.attachments} />

        <div className="mt-3 text-sm text-slate-400">
          By {reply.author.displayName} • {reply.voteScore ?? 0} votes
        </div>

        <VoteButtons targetType="reply" targetId={reply.id} userId={userId} />

        <ReplyUploadForm replyId={reply.id} userId={userId} />

        {userId ? (
          <form
            action="/api/replies"
            method="POST"
            className="mt-4 space-y-3"
          >
            <div>
              <label
                htmlFor={`reply-body-${reply.id}`}
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Reply to this reply
              </label>
              <textarea
                id={`reply-body-${reply.id}`}
                name="body"
                rows={3}
                placeholder="Write a nested reply"
                required
                className="w-full rounded bg-slate-800 p-2"
              />
            </div>

            <input type="hidden" name="postId" value={postId} />
            <input type="hidden" name="parentReplyId" value={reply.id} />

            <button className="rounded bg-slate-700 px-3 py-1">
              Reply
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Login to reply</p>
        )}
      </div>

      {childReplies.length > 0 && (
        <div className="mt-4 space-y-4">
          {childReplies.map((childReply) => (
            <ReplyCard
              key={childReply.id}
              reply={childReply}
              allReplies={allReplies}
              postId={postId}
              userId={userId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const user = token ? verifyToken(token) : null;
  const userId = user ? user.userId : null;

  const topLevelReplies = post.replies.filter(
    (reply) => reply.parentReplyId === null
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <a
          href={`/channels/${post.channel.id}`}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back
        </a>

        <div className="mt-4 rounded bg-slate-900 p-6">
          <h1 className="text-3xl font-bold">{post.title}</h1>
          <p className="mt-3">{post.body}</p>

          <Images attachments={post.attachments} />

          <div className="mt-2 text-sm">
            {post.author.displayName} • {post.voteScore ?? 0}
          </div>

          <VoteButtons targetType="post" targetId={post.id} userId={userId} />

          {userId && (
            <form
              action="/api/uploads"
              method="POST"
              encType="multipart/form-data"
              className="mt-4"
            >
              <input
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/webp"
                required
                className="block w-full text-sm"
              />
              <input type="hidden" name="targetType" value="post" />
              <input type="hidden" name="targetId" value={post.id} />

              <button className="mt-2 rounded bg-purple-600 px-3 py-1">
                Upload Screenshot
              </button>
            </form>
          )}
        </div>

        {userId ? (
          <form action="/api/replies" method="POST" className="mt-6">
            <label
              htmlFor="new-reply"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Reply to post
            </label>
            <textarea
              id="new-reply"
              name="body"
              required
              className="w-full rounded bg-slate-800 p-2"
            />
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="parentReplyId" value="" />
            <button className="mt-2 rounded bg-blue-600 px-4 py-2">
              Reply
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-slate-500">Login to reply</p>
        )}

        <div className="mt-8">
          <h2 className="mb-4 text-2xl font-semibold">Replies</h2>

          {topLevelReplies.length === 0 ? (
            <div className="rounded bg-slate-900 p-5 text-slate-400">
              No replies yet.
            </div>
          ) : (
            <div className="space-y-4">
              {topLevelReplies.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  allReplies={post.replies}
                  postId={post.id}
                  userId={userId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}