# ──────────────────────────────────────────────────────────────
# City Evacuation AI  —  Backend Dockerfile
# Production-ready: slim base, non-root user, gunicorn WSGI server
# ──────────────────────────────────────────────────────────────

# ── Stage 1: base ──────────────────────────────────────────────
FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered stdout
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ── Stage 2: dependencies ──────────────────────────────────────
FROM base AS deps

COPY requirements.txt .
# Install to a prefix so we can copy cleanly in the final stage
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 3: final image ───────────────────────────────────────
FROM base AS final

# Copy installed packages from deps stage
COPY --from=deps /install /usr/local

# Copy application source
COPY app.py .

# Create a non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# Port 8000 is conventional for gunicorn; Render / Railway map it automatically
EXPOSE 8000

# gunicorn: 2 workers × (2 × CPU + 1) is a standard heuristic for I/O-bound apps.
# The 8-puzzle solver is CPU-bound but very short-lived, so 2 workers is fine.
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60", "app:app"]
