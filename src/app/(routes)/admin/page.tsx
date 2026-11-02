import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const user = token ? verifyToken(token) : null;

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
            â† Back to home
          </Link>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h1 className="text-2xl font-bold">Access denied</h1>
            <p className="mt-2 text-slate-400">
              This page is only available to administrators.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const [users, channels, posts, replies] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.channel.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creator: {
          select: {
            displayName: true,
          },
        },
        _count: {
          select: {
            posts: true,
          },
        },
      },
    }),
    prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            displayName: true,
          },
        },
        channel: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    }),
    prisma.reply.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: {
            displayName: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          â† Back to home
        </Link>

        <h1 className="mt-4 text-3xl font-bold">Admin Panel</h1>
        <p className="mt-2 text-slate-400">
          Moderate users, channels, posts, and replies.
        </p>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">Users</h2>
          <div className="space-y-4">
            {users.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{item.displayName}</p>
                    <p className="text-sm text-slate-400">{item.email}</p>
                    <p className="text-sm text-slate-500">Role: {item.role}</p>
                  </div>

                  {item.id !== user.userId && (
                    <form
                      action={`/api/admin/users/${item.id}`}
                      method="POST"
                      onSubmit={undefined}
                    >
                      <input type="hidden" name="_method" value="DELETE" />
                      <button
                        type="submit"
                        className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-500"
                      >
                        Remove User
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">Channels</h2>
          <div className="space-y-4">
            {channels.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">#{item.name}</p>
                    <p className="text-sm text-slate-400">
                      {item.description || "No description"}
                    </p>
                    <p className="text-sm text-slate-500">
                      By {item.creator.displayName} â€¢ {item._count.posts} posts
                    </p>
                  </div>

                  <form action={`/api/admin/channels/${item.id}`} method="POST">
                    <input type="hidden" name="_method" value="DELETE" />
                    <button
                      type="submit"
                      className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-500"
                    >
                      Remove Channel
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">Posts</h2>
          <div className="space-y-4">
            {posts.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {item.body}
                    </p>
                    <p className="text-sm text-slate-500">
                      #{item.channel.name} â€¢ By {item.author.displayName} â€¢{" "}
                      {item._count.replies} replies
                    </p>
                  </div>

                  <form action={`/api/admin/posts/${item.id}`} method="POST">
                    <input type="hidden" name="_method" value="DELETE" />
                    <button
                      type="submit"
                      className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-500"
                    >
                      Remove Post
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-semibold">Replies</h2>
          <div className="space-y-4">
            {replies.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-slate-300 line-clamp-3">{item.body}</p>
                    <p className="text-sm text-slate-500">
                      By {item.author.displayName} â€¢ Post #{item.post.id}:{" "}
                      {item.post.title}
                    </p>
                  </div>

                  <form action={`/api/admin/replies/${item.id}`} method="POST">
                    <input type="hidden" name="_method" value="DELETE" />
                    <button
                      type="submit"
                      className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-500"
                    >
                      Remove Reply
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}