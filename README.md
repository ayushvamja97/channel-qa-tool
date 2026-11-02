Channel-Based Programming Q&A Tool

---

Overview

This is a full-stack discussion platform for programming-related questions.
Users can create channels, post questions, reply in threaded discussions (including nested replies), vote on content, upload screenshots, and search across posts.
An admin panel is provided for moderation.

---

Technology Stack (and Why Used)

* Next.js (App Router)
  Used for building a full-stack web application with both frontend UI and backend API routes in one project. This aligns with the requirement for a modern web application framework.

* TypeScript
  Provides type safety, better code organization, and reduces runtime errors.

* Prisma ORM
  Used for database interaction. It simplifies querying MySQL and ensures structured schema management, which matches the requirement for a relational database.

* MySQL 8.4
  Chosen as the relational database to store users, channels, posts, replies, votes, and attachments.

* Docker & Docker Compose
  Used to run both the application and database in containers. This satisfies the requirement that the project should run using docker-compose without external setup.

* JWT Authentication (cookies)
  Used for secure login sessions and role-based access (user/admin).

* bcryptjs
  Used for hashing passwords securely before storing them.

* File System (Node.js fs)
  Used for storing uploaded screenshots locally, as required for handling attachments.

---

Running the Project (Docker)

Start the application:
docker compose up --build

Stop the application:
docker compose down

Reset database (optional):
docker compose down -v
docker compose up --build

---

Access

Web App:
http://localhost:3000


---

Admin Access

Admin credentials (seeded):

Email: [admin@example.com]
Password: Set using SEED_ADMIN_PASSWORD

Admin panel:
http://localhost:3000/admin

Admin can:

* remove users
* remove channels
* remove posts
* remove replies

---

Environment Variables (.env)

DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3307/channel_qa_tool"
JWT_SECRET="YOUR_RANDOM_JWT_SECRET"
NODE_ENV="production"
UPLOAD_DIR="./uploads"
PORT="3000"

---

Available Scripts

npm run dev      -> start development server
npm run build    -> build for production
npm run start    -> run production server
npm run seed     -> seed database

---

Main Features

* Channel-based discussion system
* Create posts inside channels
* Threaded (nested) replies
* Voting system for posts and replies
* Screenshot/image uploads
* Search functionality
* Authentication (signup, login, logout)
* Admin moderation panel

---

Important Notes

* Uploaded images are stored in the "uploads/" directory
* Allowed file types: PNG, JPG, WebP (max 5MB)
* Authentication is required for posting, replying, voting, and uploads
* Admin actions are restricted to admin users only

---

Project Structure (High Level)

src/app            -> pages and API routes
src/lib            -> Prisma client and authentication logic
prisma/            -> schema and seed script
uploads/           -> stored images
docker-compose.yml -> app + database setup
Dockerfile         -> application container

---

Quick Test Checklist

* Login works
* Create channel works
* Create post works
* Reply to post works
* Reply to reply works
* Voting works
* Image upload works
* Search works
* Admin delete works

---

Getting Started (Development Mode)

Run development server:

npm run dev

Open in browser:
http://localhost:3000

---

Submission Notes

* Docker setup included (app + MySQL)
* Prisma schema and seed data included
* Authentication and admin control implemented

Run using Docker for full functionality.
