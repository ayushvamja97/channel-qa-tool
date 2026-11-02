import Link from "next/link";
export default function SignupPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <div className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <Link
            href="/"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            â† Back to home
          </Link>

          <h1 className="mt-4 text-3xl font-bold">Sign Up</h1>
          <p className="mt-2 text-slate-400">
            Create an account to post questions, reply, and vote.
          </p>

          <form action="/api/auth/signup" method="POST" className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="displayName"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Display Name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                placeholder="Your name"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

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
                placeholder="At least 6 characters"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500"
            >
              Create Account
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}