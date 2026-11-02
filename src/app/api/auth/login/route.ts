import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let email = "";
    let password = "";
    let isFormSubmission = false;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = typeof body.email === "string" ? body.email : "";
      password = typeof body.password === "string" ? body.password : "";
    } else {
      const formData = await request.formData();
      isFormSubmission = true;

      const rawEmail = formData.get("email");
      const rawPassword = formData.get("password");

      email = typeof rawEmail === "string" ? rawEmail : "";
      password = typeof rawPassword === "string" ? rawPassword : "";
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/login", request.url), 303);
      }

      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (!user) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/login", request.url), 303);
      }

      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(
      trimmedPassword,
      user.passwordHash
    );

    if (!passwordMatches) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/login", request.url), 303);
      }

      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = isFormSubmission
      ? NextResponse.redirect(new URL("/", request.url), 303)
      : NextResponse.json({
          success: true,
          user: {
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
          },
        });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);

    return NextResponse.json(
      { error: "Failed to log in." },
      { status: 500 }
    );
  }
}