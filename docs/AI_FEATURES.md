# AI setup, evaluation, and model boundaries

## Implemented features

| Feature | Implementation | Needs |
| --- | --- | --- |
| Question review | Structured title/body suggestion and missing-context checklist; explicit approval | Text API key |
| Related questions | MySQL-persisted question embeddings, model/content hashes, cosine retrieval | Embedding API key and explicit index run |
| Thread summary | Overview, source-linked points, unresolved details; reply IDs validated | Text API key |
| Visual neighbors | Local pretrained MobileNetV3 pooled features, normalized and persisted per attachment | Python service and official pretrained weights |
| Category prediction | Frozen-backbone linear-head training and held-out evaluation pipeline | Your labeled dataset and checkpoint; neither is bundled |

Missing configuration produces an explicit unavailable message, not a fabricated AI response. Regular content workflows stay independent of these optional actions.

## Text provider configuration

Copy `.env.example` to `.env`, fill core database/auth secrets, and set:

```dotenv
AI_ENABLED=true
OPENAI_API_KEY=YOUR_PRIVATE_SERVER_SIDE_KEY
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Choose models available to your account. The text model must support Responses API structured JSON output. Embeddings request 512 dimensions and are designed for text-embedding-3-small. Changing embedding models requires reindexing; incompatible model IDs are never mixed. Do not expose keys in NEXT_PUBLIC variables.

These provider requests are billed separately from ChatGPT subscriptions. Selecting review/related-question assistance sends the draft; summarizing sends the question and its replies. Indexing sends question titles/bodies. Generation requests store:false, which is not a zero-retention claim. Use synthetic content and remove secrets.

```bash
# With the AI Compose overlay running
docker compose -f docker-compose.yml -f docker-compose.ai.yml exec app npm run ai:index

# Or on the host, with .env configured
npm run ai:index
```

Indexing is explicit and skips unchanged model/content hashes. It can resume after failure. Reply text is not embedded. Deleted posts cascade-delete embedding rows; stale content hashes are excluded until reindexed. There is no automatic background indexing after a new post.

Retrieval scans compatible vectors, with a 5,000-row guard and a fixed 0.3 text similarity floor. The threshold is a demo heuristic, not the probability that a question is a duplicate.

## Local CNN service

Set a long random VISION_SERVICE_TOKEN in `.env`, then:

```bash
docker compose -f docker-compose.yml -f docker-compose.ai.yml up --build
```

The service is internal to Compose with no published port. The app sends saved image bytes using a shared service token. Docker downloads official pretrained weights during image build, requiring network access. Vision does not need AI_ENABLED or an OpenAI key.

Host development from the project root:

```bash
python3 -m venv vision/.venv
vision/.venv/bin/pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cpu
vision/.venv/bin/pip install -r vision/requirements.txt
cd vision
# Export VISION_SERVICE_TOKEN using the same value configured for the app.
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000
```

The Python process does not automatically load root `.env`; export its token into that process. The host Next.js process reads VISION_SERVICE_URL=http://localhost:8000 from `.env`. First Python startup downloads weights if not cached.

Open an attached image and select **Find similar screenshots (CNN)**. Analyze at least two images, then repeat the first to explore available neighbors. No analysis is required to upload. Six clearly labeled synthetic fixtures are attached by the expanded seed; they are not a realistic model-evaluation dataset.

### What the CNN actually does

The service uses official ImageNet preprocessing, extracts 576 pooled MobileNetV3 Small convolutional features, and L2-normalizes them. It deliberately does not present ImageNet object labels as screenshot categories. A fixed 0.8 cosine floor selects visual neighbors, which may share layout/colors without representing the same error.

Model IDs are stored with image analysis so incompatible extractors are not compared. Without a category head, category/confidence are null. A loaded head can also abstain below CLASSIFIER_THRESHOLD (default 0.7). Softmax scores are not calibrated correctness probabilities. Reanalyze images after changing a category head.

## Train a screenshot-category head

No labeled screenshot dataset, trained category head, or category-accuracy claim is included. Collect original or consented images and create matching class subfolders:

```text
vision/data/train/<category>/*
vision/data/val/<category>/*
vision/data/test/<category>/*
```

Use 2–20 matching categories, such as terminal, code-editor, browser-error, diagram, and other. Split by source/example/session, not individual crops. Crops and recolored versions of one screen must not cross splits. The script rejects exact cross-split duplicates but cannot detect all near duplicates.

From vision/:

```bash
.venv/bin/python train.py data --epochs 15 --output models/screenshot-head.pt
```

The script freezes the pretrained backbone and trains a linear category head on cached features. It selects the head by validation loss, then reports held-out test accuracy, class support, precision/recall, and a confusion matrix to screenshot-head.metrics.json. A fixed seed supports repeatability. Do not repeatedly tune against test results or quote synthetic-fixture performance as real screenshot accuracy.

For Compose, place the checkpoint in vision/models/ and set CLASSIFIER_PATH=/models/screenshot-head.pt; that directory is mounted read-only. Use an absolute local path for host inference. Restart after changing checkpoints. Load only checkpoints you created or trust. Datasets and model files are ignored by git.

## API contracts and limits

Every AI route requires a cookie, an existing user, and Origin matching the request origin. Review trusted-proxy/origin handling when deploying behind a reverse proxy. Requests are limited to 24,000 bytes even without Content-Length. The per-process limiter allows six requests per user per minute; it resets on restart and is not a distributed spending cap.

| Endpoint | JSON input | Output |
| --- | --- | --- |
| /api/ai/question | action: review, title, body | suggestion: title, body, missingDetails |
| /api/ai/question | action: similar, title, body | results: id, title, channel, score |
| /api/ai/summary | postId | summary: overview, points with replyIds, unresolved |
| /api/ai/image | attachmentId | model, category, confidence, similar image/post links |

Draft limits: 3–180 character title and 5–10,000 character body. Summary input is capped at 40 replies / 24,000 serialized characters, with a clear error rather than silently dropping the rest. Provider requests time out after 25 seconds; vision requests after 20 seconds. Vision decodes PNG/JPEG/WebP, limits files to 5 MiB and rejects decompression-bomb warnings above 16 million pixels. Images stay within the local vision service; they are not sent to the text provider.

Output is rendered as text rather than injected HTML. Prompt/data separation and schema validation reduce accidental misuse but do not eliminate hallucinations or prompt injection. Valid source IDs do not establish factual support. Users still approve suggestions and inspect original replies.

## Tests and evaluations

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Set DATABASE_URL to a fresh disposable database ending in _test, set ALLOW_TEST_DATABASE=true, then run `npm run test:integration`. It applies migrations and leaves fictional/test records in that database. Never use a real community database. Text-provider responses are mocked; supplying vision URL/token additionally exercises real CNN HTTP inference through the app route and persists vectors.

From vision/ after installing requirements-dev.txt:

```bash
.venv/bin/python -m unittest -v test_app.py
```

Tests cover auth, invalid/oversized files, actual pretrained extraction, repeatability, and vector normalization. They do not measure category accuracy. Remote CI includes MySQL 8.4 and CPU vision jobs; verify their run before displaying passing badges.

After demo seeding and indexing, `npm run ai:evaluate` runs six original paraphrase cases and prints top-1 / recall-at-5 results. It calls the real embedding API and may incur costs. No result is prefilled. This is a small smoke evaluation, not a broad benchmark; expand it with negative and ambiguous examples before claiming quality.

## Defensible portfolio wording

After running and understanding the components, a possible bullet is:

> Extended a TypeScript/Next.js Q&A platform with structured AI question review, source-linked summaries, MySQL-backed semantic retrieval, and a Python/PyTorch service for pretrained CNN image similarity; added repeatable demo data and integration tests.

Confirm your own contribution and assistance attribution. Do not claim to have trained a screenshot CNN, achieved an accuracy figure, deployed at scale, or served real users unless you complete and verify those steps.

## Primary references

- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [OpenAI embeddings API](https://developers.openai.com/api/reference/resources/embeddings/methods/create)
- [Torchvision MobileNetV3 Small weights/transforms](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.mobilenet_v3_small.html)

Published ImageNet accuracy is not screenshot-category accuracy and is not claimed for this application.
