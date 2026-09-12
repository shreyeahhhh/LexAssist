FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY Server/requirements.txt .

# sentence-transformers pulls in torch; the default PyPI wheel bundles CUDA
# support (~555MB) that this CPU-only container never uses. Install the
# CPU-only build first (~196MB) so it satisfies that dependency instead.
# --extra-index-url (not --index-url) keeps PyPI available too: PyTorch's own
# index doesn't carry every transitive build dependency (e.g. flit_core),
# and pinning the exact +cpu version stops pip from resolving torch from
# regular PyPI instead.
RUN pip install --no-cache-dir "torch==2.14.0+cpu" --extra-index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY Server/ .

EXPOSE 8080

CMD gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 app:app
