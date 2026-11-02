export function vector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(x => typeof x === "number" && Number.isFinite(x))) {
    throw new Error("Invalid embedding vector");
  }
  return value;
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2;
  }
  return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : 0;
}
