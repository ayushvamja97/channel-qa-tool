FROM python:3.11-slim
WORKDIR /service
ENV TORCH_HOME=/usr/local/share/torch
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt
COPY app.py train.py ./
# Cache official pretrained weights at image-build time rather than on the first upload.
RUN python -c "from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights; mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)"
RUN useradd --create-home inference
USER inference
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
