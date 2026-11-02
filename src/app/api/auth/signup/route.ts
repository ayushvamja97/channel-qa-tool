import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let displayName = "";
    let email = "";
    let password = "";
    let isFormSubmission = false;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      displayName =
        typeof body.displayName === "string" ? body.displayName : "";
      email = typeof body.email === "string" ? body.email : "";
      password = typeof body.password === "string" ? body.password : "";
    } else {
      const formData = await request.formData();
      isFormSubmission = true;

      const rawDisplayName = formData.get("displayName");
      const rawEmail = formData.get("email");
      const rawPassword = formData.get("password");

      displayName =
        typeof rawDisplayName === "string" ? rawDisplayName : "";
      email = typeof rawEmail === "string" ? rawEmail : "";
      password = typeof rawPassword === "string" ? rawPassword : "";
    }

    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (trimmedDisplayName.length < 2) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/signup", request.url), 303);
      }

      return NextResponse.json(
        { error: "Display name must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (!trimmedEmail || !trimmedPassword) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/signup", request.url), 303);
      }

      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (trimmedPassword.length < 6) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/signup", request.url), 303);
      }

      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    });

    if (existingUser) {
      if (isFormSubmission) {
        return NextResponse.redirect(new URL("/signup", request.url), 303);
      }

      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(trimmedPassword, 10);

    const user = await prisma.user.create({
      data: {
        displayName: trimmedDisplayName,
        email: trimmedEmail,
        passwordHash,
        role: "user",
      },
    });

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
    console.error("POST /api/auth/signup error:", error);

    return NextResponse.json(
      { error: "Failed to sign up." },
      { status: 500 }
    );
  }
}