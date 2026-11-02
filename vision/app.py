"""Local CNN feature service. No ImageNet labels are presented as screenshot categories."""
import hmac
import io
import os
import threading
import warnings
from contextlib import asynccontextmanager

import torch
import torch.nn.functional as F
from fastapi import FastAPI, HTTPException, Request
from PIL import Image, ImageOps, UnidentifiedImageError
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

MODEL_ID = "mobilenet-v3-small-imagenet1k-v1-pool576-v1"
MAX_BYTES = 5 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 16_000_000
model = None
head = None
classes = []
lock = threading.Lock()
weights = MobileNet_V3_Small_Weights.IMAGENET1K_V1
transform = weights.transforms()


def decode_image(data: bytes) -> Image.Image:
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Invalid image size")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if source.format not in {"PNG", "JPEG", "WEBP"}:
                    raise ValueError("Unsupported image format")
                source.load()
                return ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValueError("Invalid image") from exc


def infer(image: Image.Image):
    # One CPU inference at a time keeps memory predictable for the local demo.
    with lock, torch.inference_mode():
        features = model.avgpool(model.features(transform(image).unsqueeze(0))).flatten(1)
        embedding = F.normalize(features, p=2, dim=1)[0].tolist()
        category = confidence = None
        if head is not None:
            probabilities = head(features).softmax(dim=1)[0]
            score, index = probabilities.max(dim=0)
            threshold = float(os.environ.get("CLASSIFIER_THRESHOLD", "0.7"))
            if score.item() >= threshold:
                category, confidence = classes[index.item()], score.item()
        return {"model": MODEL_ID, "vector": embedding, "category": category, "confidence": confidence}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, head, classes
    torch.set_num_threads(2)
    model = mobilenet_v3_small(weights=weights).eval()
    checkpoint_path = os.environ.get("CLASSIFIER_PATH")
    if checkpoint_path:
        # Only mount checkpoints you created/trust. No arbitrary user-supplied checkpoint loading.
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
        if checkpoint["feature_model"] != MODEL_ID:
            raise ValueError("Incompatible classifier feature extractor")
        classes = checkpoint["classes"]
        if not 2 <= len(classes) <= 20 or not all(isinstance(c, str) and len(c) <= 80 for c in classes):
            raise ValueError("Invalid classifier classes")
        head = torch.nn.Linear(576, len(classes))
        head.load_state_dict(checkpoint["head"])
        head.eval()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)


@app.get("/health")
def health():
    return {"ready": model is not None, "classifierLoaded": head is not None, "model": MODEL_ID}


@app.post("/analyze")
async def analyze(request: Request):
    secret = os.environ.get("VISION_SERVICE_TOKEN", "")
    supplied = request.headers.get("authorization", "")
    if not secret or not hmac.compare_digest(supplied, f"Bearer {secret}"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Image too large")
    try:
        image = decode_image(bytes(data))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid image") from exc
    # Run CPU-bound decoding/inference off the async request loop.
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(infer, image)
