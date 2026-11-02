import assert from "node:assert/strict";

const base = "http://localhost:3000";
const password = process.env.SEED_USER_PASSWORD;
assert.ok(password, "SEED_USER_PASSWORD must be set for this disposable demo");
const request = (url, options = {}) => fetch(base + url, { ...options, signal: AbortSignal.timeout(25_000) });
let ready = false;
for (let attempt = 0; attempt < 90; attempt++) {
  try { if ((await request("/")).ok) { ready = true; break; } } catch { /* wait for startup */ }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
assert.ok(ready, "Application startup did not complete");
const login = await request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "user@example.com", password }) });
assert.equal(login.status, 200, "Seeded login failed");
const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("auth_token="), "Login did not set an auth cookie");
const channels = await (await request("/api/channels")).json();
assert.equal(channels.length, 10);
for (const name of ["python", "javascript"]) {
  const channel = channels.find(item => item.name === name);
  const details = await (await request(`/api/channels/${channel.id}`)).json();
  const prefix = name === "python" ? "Why does changing" : "Why does an async";
  const post = details.posts.find(item => item.title.startsWith(prefix));
  assert.ok(post, "Missing seeded discussion");
  const discussion = await (await request(`/api/posts/${post.id}`)).json();
  assert.ok(discussion.attachments.length, "Synthetic screenshot not seeded");
  assert.ok((await request(discussion.attachments[0].url)).ok, "Uploaded image could not be retrieved");
  const response = await request("/api/ai/image", { method: "POST", headers: { cookie, Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ attachmentId: discussion.attachments[0].id }) });
  assert.equal(response.status, 200, "CNN analysis failed");
  const result = await response.json();
  assert.equal(result.model, "mobilenet-v3-small-imagenet1k-v1-pool576-v1");
  assert.equal(result.category, null, "No category checkpoint should be loaded in this smoke run");
}
const disabled = await request("/api/ai/question", { method: "POST", headers: { cookie, Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", title: "A test question", body: "A short draft for the disabled-provider check." }) });
assert.equal(disabled.status, 503);
assert.ok((await request("/channels", { headers: { cookie } })).ok);
console.log("PASS Docker app/MySQL/CNN startup, seeded login, screenshots, real CNN inference, and disabled-text-AI fallback");
