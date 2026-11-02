import jwt from "jsonwebtoken";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");
  return value;
}

export type JwtPayload = {
  userId: number;
  email: string;
  role: string;
};

export function signToken(payload: JwtPayload) {
  return jwt.sign(payload, secret(), {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, secret()) as JwtPayload;
  } catch {
    return null;
  }
}
