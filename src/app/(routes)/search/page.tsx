import Link from "next/link";
type PostResult = {
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
    replies: number;
    votes: number;
  };
  voteScore?: number;
};

type UserResult = {
  id: number;
  displayName: string;
  email: string;
  postCount: number;
  role: string;
};

type SearchResponse = {
  type: string;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  results: Array<PostResult | UserResult>;
};

type PageProps = {
  searchParams: Promise<{
    type?: string;
    q?: string;
    author?: string;
    channelId?: string;
    page?: string;
  }>;
};

async function getSearchResults(params: {
  type?: string;
  q?: string;
  author?: string;
  channelId?: string;
  page?: string;
}): Promise<SearchResponse | null> {
  const query = new URLSearchParams();

  if (params.type) query.set("type", params.type);
  if (params.q) query.set("q", params.q);
  if (params.author) query.set("author", params.author);
  if (params.channelId) query.set("channelId", params.channelId);
  if (params.page) query.set("page", params.page);

  const hasAnySearchInput =
    !!params.type || !!params.q || !!params.author || !!params.channelId || !!params.page;

  if (!hasAnySearchInput) {
    return null;
  }

  const res = await fetch(`http://localhost:3000/api/search?${query.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

function isUserResult(item: PostResult | UserResult): item is UserResult {
  return "postCount" in item;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = params.type || "substring";
  const page = Number(params.page || "1");
  const results = await getSearchResults(params);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          Ã¢â€ Â Back to home
        </Link>

        <h1 className="mt-4 text-3xl font-bold">Search</h1>
        <p className="mt-2 text-slate-400">
          Search posts, replies, authors, and ranking-based content.
        </p>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <form method="GET" action="/search" className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="type"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Search Type
              </label>
              <select
                id="type"
                name="type"
                defaultValue={type}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none"
              >
                <option value="substring">Substring search across posts + replies</option>
                <option value="author">Content by author</option>
                <option value="most-posts">User with most posts</option>
                <option value="least-posts">User with least posts</option>
                <option value="highest-ranked">Highest-ranked content</option>
                <option value="lowest-ranked">Lowest-ranked content</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="q"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Search Text
              </label>
              <input
                id="q"
                name="q"
                defaultValue={params.q || ""}
                placeholder="e.g. closure"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="author"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Author Name
              </label>
              <input
                id="author"
                name="author"
                defaultValue={params.author || ""}
                placeholder="e.g. Admin"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="channelId"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Channel ID (optional)
              </label>
              <input
                id="channelId"
                name="channelId"
                defaultValue={params.channelId || ""}
                placeholder="e.g. 1"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none"
              />
            </div>

            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500"
              >
                Search
              </button>

              <Link
                href="/search"
                className="rounded-lg border border-slate-700 px-5 py-3 font-medium hover:bg-slate-800"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>

        {results && (
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Results</h2>
              <p className="text-sm text-slate-400">
                {results.total} total result{results.total === 1 ? "" : "s"} Ã¢â‚¬Â¢ page {results.page}
              </p>
            </div>

            {results.results.length === 0 ? (
              <div className="rounded-lg bg-slate-800 p-6 text-slate-300">
                No results found.
              </div>
            ) : (
              <div className="space-y-4">
                {results.results.map((item) =>
                  isUserResult(item) ? (
                    <div
                      key={`user-${item.id}`}
                      className="rounded-xl border border-slate-800 bg-slate-900 p-6"
                    >
                      <h3 className="text-xl font-semibold">{item.displayName}</h3>
                      <p className="mt-2 text-slate-400">{item.email}</p>
                      <div className="mt-3 text-sm text-slate-400">
                        Role: {item.role} Ã¢â‚¬Â¢ Posts: {item.postCount}
                      </div>
                    </div>
                  ) : (
                    <Link
                      key={`post-${item.id}`}
                      href={`/posts/${item.id}`}
                      className="block rounded-xl border border-slate-800 bg-slate-900 p-6 hover:bg-slate-800"
                    >
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                        <span>#{item.channel.name}</span>
                        <span>By {item.author.displayName}</span>
                        <span>{item._count.replies} replies</span>
                        <span>
                          {"voteScore" in item ? `${item.voteScore ?? 0} score` : `${item._count.votes} votes`}
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
                      <p className="mt-2 line-clamp-3 text-slate-300">{item.body}</p>
                    </Link>
                  )
                )}
              </div>
            )}

            <div className="mt-8 flex gap-3">
              {page > 1 && (
                <Link
                  href={`/search?${new URLSearchParams({
                    ...(params.type ? { type: params.type } : {}),
                    ...(params.q ? { q: params.q } : {}),
                    ...(params.author ? { author: params.author } : {}),
                    ...(params.channelId ? { channelId: params.channelId } : {}),
                    page: String(page - 1),
                  }).toString()}`}
                  className="rounded-lg border border-slate-700 px-4 py-2 hover:bg-slate-800"
                >
                  Previous
                </Link>
              )}

              {results.hasMore && (
                <Link
                  href={`/search?${new URLSearchParams({
                    ...(params.type ? { type: params.type } : {}),
                    ...(params.q ? { q: params.q } : {}),
                    ...(params.author ? { author: params.author } : {}),
                    ...(params.channelId ? { channelId: params.channelId } : {}),
                    page: String(page + 1),
                  }).toString()}`}
                  className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-500"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}