import QuestionComposer from "@/components/QuestionComposer";
import Link from "next/link";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth/jwt";

type Post = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  author: {
    displayName: string;
  };
  _count: {
    replies: number;
    votes: number;
  };
};

type Channel = {
  id: number;
  name: string;
  description: string | null;
  creator: {
    displayName: string;
  };
  posts: Post[];
};

async function getChannel(id: string): Promise<Channel> {
  const res = await fetch(`http://localhost:3000/api/channels/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch channel");
  }

  return res.json();
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await getChannel(id);

  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const user = token ? verifyToken(token) : null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/channels"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Ã¢â€ Â Back to channels
        </Link>

        <h1 className="mt-4 text-3xl font-bold">#{channel.name}</h1>

        <p className="mt-2 text-slate-400">
          {channel.description || "No description"}
        </p>

        <p className="mt-2 text-sm text-slate-500">
          Created by {channel.creator.displayName}
        </p>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">Create Post</h2>

          {user ? (
            <QuestionComposer channelId={channel.id} />
          ) : (
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-slate-300">
              You must be logged in to create a post.{" "}
              <Link href="/login" className="text-blue-400 hover:text-blue-300">
                Login here
              </Link>
              .
            </div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="mb-2 text-2xl font-semibold">Posts</h2>
          <p className="mb-4 text-sm text-slate-400">
            Click any post to open the full discussion and add replies.
          </p>

          {channel.posts.length === 0 ? (
            <div className="rounded-lg bg-slate-800 p-6">
              No posts yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {channel.posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800"
                >
                  <h3 className="text-xl font-semibold">{post.title}</h3>

                  <p className="mt-2 text-slate-300">{post.body}</p>

                  <div className="mt-4 text-sm text-slate-400">
                    By {post.author.displayName} Ã¢â‚¬Â¢ {post._count.replies} replies
                    {" Ã¢â‚¬Â¢ "}
                    {post._count.votes} votes
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
