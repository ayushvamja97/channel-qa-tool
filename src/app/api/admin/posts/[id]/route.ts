// src/app/api/admin/posts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth/jwt";

async function ensureAdmin(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const user = token ? verifyToken(token) : null;

  if (!user) return { error: NextResponse.redirect(new URL("/login", request.url), 303) };
  if (user.role !== "admin") return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };

  return { user };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await ensureAdmin(request);
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  if (formData.get("_method") !== "DELETE") {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  const { id } = await params;
  const postId = Number(id);

  await prisma.post.delete({ where: { id: postId } });

  return NextResponse.redirect(new URL("/admin", request.url), 303);
}