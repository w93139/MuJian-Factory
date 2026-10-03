FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y ffmpeg fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir uv==0.12.5

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
RUN python -m playwright install --with-deps --only-shell chromium

# Copy only shipped source and templates. Local config, credentials, and generated
# code/data and code/result files never enter the image.
COPY *.py ./
COPY config.yaml.example ./
COPY api ./api
COPY core ./core
COPY models ./models
COPY pipelines ./pipelines
COPY prompts ./prompts
COPY templates ./templates

RUN mkdir -p /app/code/data /app/code/result /app/temp

EXPOSE 8000
CMD ["uvicorn", "api.app:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
