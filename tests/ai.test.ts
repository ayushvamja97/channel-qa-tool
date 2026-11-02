import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { NextRequest } from "next/server";
import { z } from "zod";
import { cosine, vector } from "../src/lib/ai/math";
import { generate, embed, AiError } from "../src/lib/ai/provider";
import { summarySchema, validateCitations } from "../src/lib/ai/summary";
import { readAIInput } from "../src/lib/ai/access";
import { POST as question } from "../src/app/api/ai/question/route";
import { demoContent } from "../prisma/demo-content";

test("similarity handles aligned, opposite, zero, and incompatible vectors", () => {
  assert.equal(cosine([1, 0], [2, 0]), 1);
  assert.equal(cosine([1, 0], [-1, 0]), -1);
  assert.equal(cosine([0, 0], [1, 0]), 0);
  assert.equal(cosine([1], [1, 2]), 0);
  assert.throws(() => vector([1, NaN]));
});

test("summary source IDs must exist in the supplied discussion", () => {
  const summary = summarySchema.parse({ overview: "Two approaches", points: [{ text: "Try a guard", replyIds: [12] }], unresolved: [] });
  assert.equal(validateCitations(summary, [12]).points.length, 1);
  assert.throws(() => validateCitations(summary, [13]), AiError);
});

test("JSON body limits apply even when Content-Length is absent", async () => {
  const request = new NextRequest("http://localhost:3000/api/ai/question", { method: "POST", body: JSON.stringify({ body: "x".repeat(25_000) }) });
  await assert.rejects(() => readAIInput(request), (error: unknown) => error instanceof AiError && error.status === 413);
});

test("cross-origin and anonymous AI requests fail before database/provider calls", async () => {
  const foreign = new NextRequest("http://localhost:3000/api/ai/question", { method: "POST", headers: { origin: "https://elsewhere.example" }, body: "{}" });
  assert.equal((await question(foreign)).status, 403);
  const anonymous = new NextRequest("http://localhost:3000/api/ai/question", { method: "POST", headers: { origin: "http://localhost:3000" }, body: "{}" });
  assert.equal((await question(anonymous)).status, 401);
});

test("disabled AI never calls an external provider", async () => {
  const original = process.env.AI_ENABLED;
  process.env.AI_ENABLED = "false";
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("Must not call"); });
  try {
    await assert.rejects(() => embed("a question"), AiError);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { fetchMock.mock.restore(); if (original === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = original; }
});

test("provider boundary validates structured output, refuses incomplete responses, and hides provider errors", async () => {
  const previous = { enabled: process.env.AI_ENABLED, key: process.env.OPENAI_API_KEY };
  process.env.AI_ENABLED = "true"; process.env.OPENAI_API_KEY = "synthetic-test-key";
  let response: unknown = { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"message":"Reviewed"}' }] }] };
  let status = 200;
  const fetchMock = mock.method(globalThis, "fetch", async (_url: string | URL | Request, options?: RequestInit) => {
    const payload = JSON.parse(options?.body as string);
    if (payload.input) assert.equal(typeof payload.input, "string");
    return Response.json(response, { status });
  });
  try {
    const schema = z.object({ message: z.string() });
    assert.deepEqual(await generate("test", "Review", { body: "Untrusted text" }, schema), { message: "Reviewed" });
    response = { status: "incomplete", output: [] };
    await assert.rejects(() => generate("test", "Review", {}, schema), AiError);
    response = { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "not JSON" }] }] };
    await assert.rejects(() => generate("test", "Review", {}, schema), AiError);
    status = 429; response = { error: "private upstream diagnostic" };
    await assert.rejects(() => generate("test", "Review", {}, schema), (error: unknown) => error instanceof AiError && !error.message.includes("private"));
  } finally {
    fetchMock.mock.restore();
    if (previous.enabled === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = previous.enabled;
    if (previous.key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous.key;
  }
});

test("demo corpus has unique questions across ten channels and valid application lengths", () => {
  assert.equal(Object.keys(demoContent).length, 10);
  const questions = Object.values(demoContent).flat();
  assert.equal(questions.length, 60);
  assert.equal(new Set(questions.map(row => row[0])).size, 60);
  for (const [title, body, answer] of questions) {
    assert.ok(title.length >= 3 && title.length <= 180);
    assert.ok(body.length >= 5 && body.length <= 10_000);
    assert.ok(answer.length >= 2 && answer.length <= 10_000);
  }
});
