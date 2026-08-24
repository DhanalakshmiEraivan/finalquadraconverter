FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# ------------------------------------------------------------
# System packages
# ------------------------------------------------------------

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    tesseract-ocr-tam \
    tesseract-ocr-tel \
    tesseract-ocr-mal \
    tesseract-ocr-kan \
    tesseract-ocr-mar \
    tesseract-ocr-ben \
    tesseract-ocr-guj \
    tesseract-ocr-pan \
    tesseract-ocr-ori \
    tesseract-ocr-urd \
    tesseract-ocr-san \
    fonts-noto-core \
    fonts-noto-extra \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-noto-mono \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------
# Application
# ------------------------------------------------------------

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# ------------------------------------------------------------
# Verify OCR installation during build
# ------------------------------------------------------------

RUN tesseract --version

RUN tesseract --list-langs

# ------------------------------------------------------------
# Start FastAPI
# ------------------------------------------------------------

EXPOSE 8000

CMD ["sh", "-c", "uvicorn converter_api:app --host 0.0.0.0 --port ${PORT:-8000}"]
