import Link from "next/link";
export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <Link
            href="/"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            ← Back to home
          </Link>

          <h1 className="mt-4 text-3xl font-bold">Login</h1>
          <p className="mt-2 text-slate-400">
            Sign in to create channels, posts, replies, and votes.
          </p>

          <form action="/api/auth/login" method="POST" className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500"
            >
              Login
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            <p className="font-medium text-slate-300">Demo accounts</p>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-blue-400 hover:text-blue-300">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
