FROM python:3.11-bullseye

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install Node.js 20 and pnpm via corepack
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    npm install -g corepack@latest && corepack enable && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend Python dependencies first (better layer caching)
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r backend/requirements.txt

# Install frontend dependencies with pnpm
COPY front/new/pnpm-lock.yaml front/new/pnpm-lock.yaml
COPY front/new/package.json front/new/package.json
RUN cd front/new && corepack prepare pnpm@9.12.2 --activate && pnpm install --frozen-lockfile

# Copy the rest of the repository
COPY . .

EXPOSE 3000 8000

CMD ["bash"]
