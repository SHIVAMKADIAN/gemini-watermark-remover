# Classical (CPU) image — FastAPI + OpenCV + vidfill + FFmpeg. No GPU.
# For the model backends, base this on an nvidia/cuda image and add the
# [lama]/[propainter] extras + fetched weights.
FROM python:3.11-slim

# FFmpeg is required for video decode/encode (with H.264 + audio passthrough).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the sibling vidfill package first, then this service.
COPY vidfill /app/vidfill
COPY server /app/server
RUN pip install --no-cache-dir -e /app/vidfill -e /app/server

ENV WM_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8000

CMD ["wmserver", "--host", "0.0.0.0", "--port", "8000"]
