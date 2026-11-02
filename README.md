# Channel Q&A Tool

A full-stack programming discussion platform that keeps questions, answers, and screenshots organized by topic. Readers can browse public discussions; signed-in users can create channels, ask questions, join nested conversations, and vote on useful content.

Built with **Next.js 16, React 19, TypeScript, Prisma, MySQL 8.4, and Docker Compose**.

[Quick start](#quick-start-docker) · [Architecture](#architecture) · [Demo walkthrough](#demo-walkthrough) · [Testing](#testing-and-validation) · [Portfolio notes](#what-i-built-and-learned)

## Why this project

Programming questions often need more context than a single message: a topic, a reproducible problem, a screenshot, and follow-up discussion. Channel Q&A brings those pieces together in one application, with search to rediscover previous discussions and an administrator view for moderation.

This repository demonstrates an end-to-end application: server-rendered pages, HTTP handlers, cookie-based authentication, relational data modeling, file uploads, and a containerized app/database workflow. No hosted demo URL has been verified; the demo below runs locally.

## Features

| Capability | Implemented behavior |
| --- | --- |
| Topic channels | Public browsing; authenticated creation; unique, lowercase names |
| Questions | Create a title and body within a channel; view author and discussion details |
| Threaded replies | Reply to a question or another reply; recursive rendering of nested conversations |
| Voting | Upvote/downvote posts and replies; repeat the same vote to remove it, or switch direction |
| Screenshots | Attach PNG, JPEG, or WebP images to posts/replies, up to 5 MiB per file |
| Search | Text across titles, bodies, and replies; author search; most/least prolific users; highest/lowest scored posts |
| Accounts | Signup, login, logout; bcrypt password hashing; seven-day JWT sessions in HTTP-only cookies |
| Administration | Role-gated dashboard and removal handlers for users, channels, posts, and replies; see current limitations below |
| Persistence | MySQL records and uploaded files stored in separate Docker named volumes |

Search returns 10 results per page. Channel filtering applies to text and author searches. Ranked-post searches calculate scores in application memory; this is a straightforward implementation for small datasets rather than an optimized large-scale search service.

## Tech stack

| Layer | Technology and purpose |
| --- | --- |
| UI and HTTP server | Next.js 16.2.2 App Router, React 19.2.4, TypeScript |
| Styling | Tailwind CSS 4; dark interface with utility classes |
| Data access | Prisma 6, shared Prisma client, versioned SQL migration |
| Database | MySQL 8.4 with foreign keys and unique constraints |
| Authentication | `jsonwebtoken` and `bcryptjs`; `auth_token` cookie |
| Attachments | Node.js filesystem APIs, UUID filenames, database metadata |
| Local infrastructure | Node 20 Alpine Docker image and Docker Compose |
| Static checks | ESLint 9 and TypeScript strict mode |

## Quick start (Docker)

Prerequisites: Git and Docker with the Compose plugin. Ports **3000** and **3307** must be available.

```bash
git clone https://github.com/ayushvamja97/channel-qa-tool.git
cd channel-qa-tool
```

Create a root `.env` file (no `.env.example` is currently tracked):

```dotenv
MYSQL_ROOT_PASSWORD=REPLACE_WITH_RANDOM_HEX_PASSWORD
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
SEED_ADMIN_PASSWORD=REPLACE_WITH_A_LOCAL_ADMIN_PASSWORD
SEED_USER_PASSWORD=REPLACE_WITH_A_LOCAL_USER_PASSWORD
```

Replace every placeholder before starting. For example, generate each value separately with `openssl rand -hex 32` if OpenSSL is installed. Hex values avoid URL-encoding problems in the database connection string. Use seed passwords without leading or trailing whitespace because login trims submitted passwords.

```bash
docker compose up --build
```

Open **http://localhost:3000** once the app is ready. The database health check gates app startup. The image generates Prisma Client and builds Next.js; container startup then runs migrations, seeds demo data, and starts the production server.

```bash
# Inspect startup failures
docker compose logs -f app db

# Stop containers while retaining data
docker compose down
```

**Destructive reset:** `docker compose down -v` removes both the database and uploaded-image volumes. Use it only when you intend to discard local demo data.

The production configuration marks authentication cookies `Secure`. Modern browsers generally treat localhost specially, but verify login persistence in your browser. For other hosts, use HTTPS; for plain-HTTP development, use the development setup below.

### Environment variables

| Variable | Where used | Notes |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | Compose database and app connection URL | Required for Docker; use a URL-safe value or adapt the connection URL |
| `DATABASE_URL` | Prisma CLI and client | Compose sets `mysql://root:<password>@db:3306/channel_qa_tool`; host development uses `localhost:3307` |
| `JWT_SECRET` | JWT signing and verification | Set a strong value explicitly; the code currently has an insecure fallback if omitted |
| `SEED_ADMIN_PASSWORD` | Seed script | Required when seeding; sets `admin@example.com` password |
| `SEED_USER_PASSWORD` | Seed script | Required when seeding; sets `user@example.com` password |
| `NODE_ENV` | Runtime/cookie configuration | Compose sets `production`; use `development` for the local development server |
| `PORT` | Next.js server | Compose fixes this to `3000`; page-to-API fetches also assume port 3000 |
| `UPLOAD_DIR` | Declared by Compose | Currently **not read** by upload handlers; files always use `<project>/uploads` |

Keep `.env` and real credentials out of version control. Compose passes the required values into the app; its `.env` file is excluded from the Docker build context.

### Development without the app container

Use Node.js 20 compatible with the pinned Next.js release and npm. Keep the same `.env` values above and add:

```dotenv
DATABASE_URL="mysql://root:YOUR_MYSQL_ROOT_PASSWORD@localhost:3307/channel_qa_tool"
NODE_ENV=development
PORT=3000
```

Replace `YOUR_MYSQL_ROOT_PASSWORD` with the value used for MySQL.

```bash
docker compose up -d db
npm ci
npx prisma generate
npx prisma migrate deploy
```

Wait for the database to become healthy before applying migrations. Export the seed passwords into the shell before running the standalone seed script: that script does not explicitly load `.env`.

```bash
export SEED_ADMIN_PASSWORD='YOUR_LOCAL_ADMIN_PASSWORD'
export SEED_USER_PASSWORD='YOUR_LOCAL_USER_PASSWORD'
npm run seed
npm run dev
```

Prisma configuration loads `.env`; Next.js also loads it for the application. The Docker path passes seed passwords through the container environment automatically. Do not run the app container and the host development server on port 3000 simultaneously.

## Architecture

One Next.js application serves the UI and HTTP endpoints. MySQL stores relational data; image bytes live outside the database.

```mermaid
flowchart TD
  Browser["Browser"] --> Pages["Next.js server-rendered pages"]
  Browser --> Routes["Route handlers: forms and JSON"]
  Pages -->|"HTTP reads on localhost:3000"| Routes
  Pages -->|"Admin reads"| Prisma["Shared Prisma client"]
  Routes --> Auth["JWT verification / role checks"]
  Routes --> Prisma
  Prisma --> DB[("MySQL 8.4")]
  Routes --> Files["Filesystem: uploads volume"]
  Browser -->|"GET /uploads/filename"| FilesRoute["Image-serving route"]
  FilesRoute --> Files
```

The diagram's authentication node describes checks inside individual handlers, not a global middleware layer. The admin page reads Prisma directly, while channel, post, and search pages fetch the application's own API with caching disabled.

### Request flow: posting and reading a reply

1. Login verifies a bcrypt hash and sets the signed `auth_token` cookie. Signup creates a regular user and also starts a session.
2. The discussion form sends `POST /api/replies` with `postId`, `body`, and optional `parentReplyId`.
3. The handler verifies the cookie, validates the content and author, and checks that any parent reply belongs to the same post. Author identity comes from the token.
4. Prisma inserts the reply in MySQL. Browser form submissions receive a `303` redirect to the discussion; JSON requests receive the created record.
5. The post page fetches `GET /api/posts/:id`. The handler returns replies, attachment URLs, and calculated vote scores; the page reconstructs the reply tree from `parentReplyId`.

For uploads, the handler checks authentication, target existence, declared MIME type, and file size, writes a UUID-named file, and creates an `Attachment` record. `GET /uploads/:filename` serves the bytes publicly with long-lived cache headers.

## Database relationships

The schema contains six models:

```mermaid
erDiagram
  User ||--o{ Channel : creates
  User ||--o{ Post : authors
  User ||--o{ Reply : authors
  User ||--o{ Vote : casts
  Channel ||--o{ Post : contains
  Post ||--o{ Reply : contains
  Reply o|--o{ Reply : parents
  Post o|--o{ Vote : receives
  Reply o|--o{ Vote : receives
  Post o|--o{ Attachment : has
  Reply o|--o{ Attachment : has
```

- `User.email` and `Channel.name` are unique.
- Each post belongs to one channel and one author; each reply belongs to one post and one author.
- A nullable `Reply.parentReplyId` makes top-level and nested replies share the same table.
- Composite unique constraints on `(userId, postId)` and `(userId, replyId)` prevent duplicate votes per target. The vote handler accepts only `1` or `-1` and chooses one target.
- Votes and attachments have optional post/reply foreign keys. The schema itself does not enforce an exclusive-or constraint on those targets; request handlers select the target.
- Attachment metadata includes filename, MIME type, size, and creation time; image bytes remain on disk.

See [`schema.prisma`](prisma/schema.prisma) and the [initial migration](prisma/migrations/20260406224249_init/migration.sql) for exact fields and referential actions.

## API reference

Paths below are relative to `http://localhost:3000`. Authenticated requests use the `auth_token` cookie rather than a bearer-token header.

| Method | Endpoint | Purpose / inputs | Access |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `displayName`, `email`, `password` | Public |
| POST | `/api/auth/login` | `email`, `password` | Public |
| POST | `/api/auth/logout` | Clear session cookie; redirect home | Public |
| GET / POST | `/api/channels` | List channels / create with `name`, optional `description` | Public read; authenticated write |
| GET | `/api/channels/:id` | Channel and its posts | Public |
| POST | `/api/posts` | `channelId`, `title`, `body` | Authenticated |
| GET | `/api/posts/:id` | Post, replies, scores, attachment URLs | Public |
| POST | `/api/replies` | `postId`, `body`, optional `parentReplyId` | Authenticated |
| POST | `/api/votes` | `targetType` (`post`/`reply`), `targetId`, `value` (`1`/`-1`) | Authenticated |
| POST | `/api/uploads` | Multipart: `file`, `targetType`, `targetId` | Authenticated |
| GET | `/api/search` | Search parameters described below | Public |
| POST | `/api/admin/{users,channels,posts,replies}/:id` | Form field `_method=DELETE` | Admin |
| GET | `/uploads/:filename` | Retrieve an uploaded image | Public |

Signup/login, channel/post/reply creation, and voting support both JSON and browser form submissions. Successful form writes redirect; JSON creation handlers return `201` for channels, posts, and replies. Upload and admin handlers use forms and redirects. Error behavior varies between JSON and forms; form validation often redirects without a detailed inline message.

Search accepts `type`, `page`, and mode-specific fields:

| `type` | Additional fields | Result |
| --- | --- | --- |
| `substring` (default) | `q`, optional `channelId` | Posts matching title, body, or reply text |
| `author` | `author`, optional `channelId` | Posts whose author's display name matches |
| `most-posts`, `least-posts` | None | Users ordered by authored-post count |
| `highest-ranked`, `lowest-ranked` | None | Posts ordered by the sum of vote values |

Example public read:

```bash
curl 'http://localhost:3000/api/search?type=substring&q=closures&page=1'
```

## Demo walkthrough

Allow about five minutes after startup. Use short sample content because the current migration stores text in `VARCHAR(191)` columns.

| Account | Email | Password |
| --- | --- | --- |
| Regular user | `user@example.com` | Your `SEED_USER_PASSWORD` value |
| Administrator | `admin@example.com` | Your `SEED_ADMIN_PASSWORD` value |

These are local seed accounts, not published hosted-demo credentials. The seed creates `javascript`, `nextjs`, and `docker` channels, two sample questions, and a reply on the closures question. It upserts both demo accounts and resets their passwords and roles each time it runs; Docker runs it on every app-container start.

1. Open `/channels` while signed out, then open `javascript` and **How do closures work in JavaScript?**
2. Sign in as the regular user. Add a reply, then use **Reply to this reply** to show nested discussion.
3. Upvote a post or reply, repeat the vote to remove it, then switch between upvote and downvote to show score changes.
4. Attach a PNG, JPEG, or WebP file under 5 MiB to the post or a reply, and reload to show persistence.
5. Create a disposable channel and a short question. The creation flow returns to the channel; open the new question from its list.
6. Open `/search`; try text `closures`, author `Admin`, and the highest-ranked mode. Try channel filtering in text/author mode.
7. Log out and sign in as the admin, then open `/admin` directly. Demonstrate removal using disposable data: remove a reply, a reply-free post, then its empty channel. Populated post/channel removal has the constraints described below.
8. Sign in as a regular user and visit `/admin` to show the access-denied view. Log out and verify that write forms require authentication.

### Screenshots

**Pending actual application captures.** No screenshots are included in this repository snapshot. The following are capture placeholders, not evidence of a completed visual test:

| Planned file | Capture |
| --- | --- |
| `docs/screenshots/channels.png` | Channel list and creation form |
| `docs/screenshots/discussion.png` | A question with nested replies, vote scores, and an uploaded image |
| `docs/screenshots/search.png` | Search mode and visible results |
| `docs/screenshots/admin.png` | Administrator moderation view using synthetic data |

Add real captures at these paths and embed them after review. Hide personal data and credentials. Confirm that each image matches the current build before publishing it.

## Testing and validation

The repository currently includes no automated test suite, `test` script, or CI workflow. The commands below are validation steps to run, not a claim that they have passed.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Run them after installing dependencies and generating Prisma Client, with `DATABASE_URL` configured. The build uses `next/font/google`, so font fetching may require network access. Lint and type checks do not replace browser/API verification.

Manual checks for a disposable local database:

- Signup, duplicate email, invalid credentials, login persistence, logout, and signed-out writes.
- Channel creation and duplicate names; valid/invalid post and reply bodies; missing targets.
- Nested replies and rejection of a parent reply from another post.
- Vote creation, repeat-to-remove, direction changes, and separate votes by different users.
- Image attachment to posts/replies; unsupported MIME type and oversized-file rejection.
- All six search modes, text/author channel filtering, and pagination with more than 10 results.
- Admin route access, self-deletion prevention, transactional user removal, and dependent-content behavior.
- Stop/restart containers and verify database records and uploaded files persist.

**Documentation review status:** Source, schema, migration, seed, scripts, and Docker configuration were inspected for this README. Application startup, browser flows, build/lint/type checks, and screenshots were not executed or captured during the documentation review because the review environment did not provide Docker or installed project dependencies.

## Current limitations and next improvements

- **Deletion semantics:** Channel deletion is blocked by existing posts, and post deletion is blocked by existing replies under the current foreign keys. Those handlers issue direct deletes without dependency cleanup. User deletion has a separate transaction that reassigns channels and removes dependent records and reply subtrees. Removing attachment records does not remove image files from disk.
- **Text limits:** The initial migration uses `VARCHAR(191)` for post/reply bodies and other string fields. Handler minimum-length validation does not impose matching maximums. Longer questions need schema and validation changes.
- **Deployment assumptions:** Several server pages fetch `http://localhost:3000/api/...` directly. A public deployment needs verified internal routing, HTTPS, database/storage provisioning, and a reviewed seed policy. No deployment or uptime claim is made here.
- **Authentication hardening:** Always supply `JWT_SECRET`; remove the fallback before public deployment. Roles are carried in seven-day tokens, with no implemented server-side session revocation. Production cookie settings alone do not establish production readiness.
- **Upload permissions:** Any authenticated user can attach an image to an existing post/reply; ownership is not checked. Image retrieval is public, and validation relies on the submitted MIME type rather than inspecting file contents. Filesystem writes and metadata inserts are not atomic.
- **Search and UI:** Ranking loads all posts/votes before sorting; some lists are unpaginated. User-count search returns email addresses publicly. The post page's internal API fetch does not forward the browser cookie, so API `currentUserVote` information is not personalized in that fetch; buttons still submit votes using the browser cookie.
- **Verification work:** Add integration coverage for auth, nested replies, votes, uploads, and moderation; improve form error feedback and review visible text encoding before recording a demo.

## What I built and learned

**Implementation scope:** A full-stack Q&A application spanning topic-based navigation, account flows, relational persistence, recursive replies, vote toggling, screenshot handling, search, moderation, and Docker orchestration.

**Portfolio reflection draft — author confirmation needed:** “I connected server-rendered pages to HTTP handlers and a relational database, modeled nested discussions with a self-referencing relationship, and used unique constraints to support one vote per user and target. Building the project helped me understand how authentication, database integrity, file persistence, and container startup interact. The next iteration would focus on automated integration tests, consistent deletion behavior, and deployment configuration.”

This reflection is proposed wording based on the code, not a verified account of personal learning or sole authorship. Confirm your individual contribution, any collaborators or course requirements, and any assistance/tools you want credited before presenting it as your own experience. No user counts, performance benchmarks, production-readiness claims, or deployment outcomes have been inferred.

## Project map

| Path | Responsibility |
| --- | --- |
| `src/app/page.tsx`, `layout.tsx` | Landing page, navigation, session-aware header |
| `src/app/(routes)/` | Channels, discussions, authentication, search, and admin pages |
| `src/app/api/` | Authentication, content, votes, uploads, search, and moderation handlers |
| `src/app/uploads/[...path]/route.ts` | Uploaded-image retrieval |
| `src/lib/auth/jwt.ts` | Token signing and verification |
| `src/lib/prisma.ts` | Shared database client |
| `prisma/` | Data model, migration, and demo seed |
| `Dockerfile`, `docker-compose.yml` | App image, MySQL service, health check, persistent volumes |

## Before sharing the portfolio

- [ ] Confirm the first-person reflection and attribution above.
- [ ] Capture and approve real screenshots; replace the capture placeholders.
- [ ] Run the documented setup and validation checks on your machine and record actual results.
- [ ] If adding a live demo, confirm its URL, hosting details, data-reset policy, and safe public demo access. Do not publish real passwords.
- [ ] Confirm a license before adding any open-source license badge or reuse claim; no license file is currently tracked.

Documentation is grounded in repository commit [`a1bd058`](https://github.com/ayushvamja97/channel-qa-tool/commit/a1bd0585a3c8c2839eb3dad608a89d693f1fb042). Subsequent code changes may require corresponding updates.
