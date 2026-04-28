FROM node:20-bookworm-slim

# Playwright 시스템 의존성
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libgbm1 \
    libxshmfence1 \
    libgtk-3-0 \
    libnss3 \
    libxss1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/adapters/package.json ./packages/adapters/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/worker ./apps/worker

RUN pnpm --filter worker build

EXPOSE 8080

CMD ["node", "apps/worker/dist/index.js"]
