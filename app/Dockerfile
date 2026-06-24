# Portable Tabaqa API image — runs on Render, Fly, Railway, or anything that
# takes a Dockerfile. Build context is app/ (this directory).
FROM python:3.12-slim

WORKDIR /app

# Install slim runtime deps first for layer caching.
COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

# App code (api/, pipeline/, scoring/, affordability.py, data/ for personas).
COPY . .

ENV PORT=8000
EXPOSE 8000

# $PORT is provided by the host (Render/Fly set it); default 8000 locally.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
