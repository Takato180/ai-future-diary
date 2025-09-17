FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src
ENV PYTHONUNBUFFERED=1

# Cloud Run は $PORT を渡してくる。既定は 8080
CMD exec uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8080}
