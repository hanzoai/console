# Production-ready Dockerfile for Hanzo Cloud Dashboard
# Multi-stage build optimized for Next.js applications

# ===== Base Stage =====
FROM node:24-alpine@sha256:cd6fb7efa6490f039f3471a189214d5f548c11df1ff9e5b181aa49e22c14383e AS base

# Install system dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    libc6-compat \
    dumb-init \
    tini \
    ca-certificates && \
    rm -rf /var/cache/apk/*

# Enable Corepack for pnpm (pinned version for reliability)
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

# Create app directory with proper permissions
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

# ===== Dependencies Stage =====
FROM base AS deps

# Copy package files
COPY --chown=nextjs:nodejs package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY --chown=nextjs:nodejs .npmrc* ./
COPY --chown=nextjs:nodejs turbo.json* ./
COPY --chown=nextjs:nodejs patches/ ./patches/

# Copy workspace package files
COPY --chown=nextjs:nodejs web/package.json ./web/
COPY --chown=nextjs:nodejs worker/package.json ./worker/
COPY --chown=nextjs:nodejs packages/shared/package.json ./packages/shared/
COPY --chown=nextjs:nodejs packages/ee/package.json ./packages/ee/
COPY --chown=nextjs:nodejs packages/config-eslint/package.json ./packages/config-eslint/
COPY --chown=nextjs:nodejs packages/config-typescript/package.json ./packages/config-typescript/
COPY --chown=nextjs:nodejs packages/console-js/package.json ./packages/console-js/
COPY --chown=nextjs:nodejs packages/hanzo-langchain/package.json ./packages/hanzo-langchain/

# Switch to nextjs user for security
USER nextjs

# Install dependencies with frozen lockfile
RUN --mount=type=cache,id=pnpm,target=/app/.pnpm-store pnpm install --frozen-lockfile

# ===== Builder Stage =====
FROM deps AS builder

# Copy source code
COPY --chown=nextjs:nodejs . .

# Set build environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Skip env.mjs validation during Docker build
ENV DOCKER_BUILD=1

# Ensure .next dir is owned by nextjs before cache mount creates subdirectory
RUN mkdir -p /app/web/.next

# Build the application (adaptive memory to avoid OOM)
RUN --mount=type=cache,target=/app/web/.next/cache,uid=1001,gid=1001 \
    NODE_OPTIONS='--max-old-space-size-percentage=75' pnpm build

# ===== Development Stage =====
FROM deps AS development

# Copy source code
COPY --chown=nextjs:nodejs . .

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=development
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const req = http.request({hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET'}, \
    (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.end();" || exit 1

# Development command with hot reload
CMD ["pnpm", "dev"]

# ===== Production Stage =====
FROM base AS production

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/web/public ./web/public

# Copy worker if it exists
COPY --from=builder --chown=nextjs:nodejs /app/worker/dist ./worker/dist

# Switch to nextjs user for security
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const req = http.request({hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET'}, \
    (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.end();" || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Production command
CMD ["node", "web/server.js"]

# ===== Default to production =====
FROM production