# Simple Dockerfile for Hanzo Cloud (web + worker)
FROM node:20-alpine

# Install pnpm
RUN corepack enable
RUN corepack prepare pnpm@9.5.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY web/package.json ./web/
COPY worker/package.json ./worker/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN cd web && pnpm run build

EXPOSE 3000

# Default to running web, can be overridden
CMD ["pnpm", "--filter", "web", "start"]