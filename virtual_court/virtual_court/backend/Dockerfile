FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY virtual_court/virtual_court/backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY virtual_court/virtual_court/backend/ .

EXPOSE 8080

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
