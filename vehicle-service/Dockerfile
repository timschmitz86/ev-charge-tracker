# ---- build stage: compile native wheels ----
FROM python:3.14.7 AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---- runtime stage: slim image without gcc ----
FROM python:3.14.7-slim

WORKDIR /app

# Copy pre-built packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY app/ app/

EXPOSE 8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
