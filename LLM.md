# Hanzo Cloud Platform Analysis

## Overview
Hanzo is an open-source LLM engineering platform designed to help teams develop, monitor, evaluate, and debug AI applications. It serves as a collaborative platform for managing the lifecycle of AI applications with a focus on observability, prompt management, evaluation, and debugging.

Key capabilities include:
- LLM Application Observability
- Prompt Management
- Evaluations
- Datasets for testing and benchmarking
- LLM Playground
- Comprehensive API

## Repository Structure
This is a monorepo managed with pnpm and Turbo, containing:

- **web/** - Main NextJS application (frontend + backend)
- **worker/** - Background processing service (not yet in production)
- **packages/**
  - **shared/** - Common code, database models, utilities
  - **config-eslint/** - ESLint configurations
  - **config-typescript/** - TypeScript configurations
  - **ee/** - Enterprise edition features

## Technology Stack

### Frontend
- Next.js 15.5 (pages router, standalone output)
- React 19
- Tailwind CSS with Radix UI primitives (shadcn-style local components)
- tRPC for type-safe API interactions
- Icons: lucide-react (primary, 347 imports) + @phosphor-icons (secondary, 113) + react-icons/si,tb (brand logos only, eslint-gated)
- Charts: recharts (primary), @tremor/react (beta, being evaluated for removal)
- Graph viz: @xyflow/react (workflow DAGs), vis-network (trace graphs), elkjs/dagre (layout)

### Backend
- Node.js
- Express (for worker)
- tRPC (API for frontend)
- REST API (public API)

### Data Storage
- PostgreSQL with Prisma ORM
- ClickHouse for analytics and trace data
- Redis for caching and queuing
- MinIO for S3-compatible object storage

### Infrastructure
- Docker and Docker Compose for local development
- Kubernetes (Helm) for production deployment

## Core Features

### Tracing System
The platform provides comprehensive observability of LLM applications through a tracing system that tracks:
- LLM calls
- Associated metadata
- Application logic

Traces are structured as hierarchical observations, with different types (events, generations, spans).

### Prompt Management
The platform enables centralized management of prompts with:
- Version control
- Collaborative iteration
- Caching for performance

### Evaluations
Various evaluation methods are supported:
- LLM-as-a-judge
- User feedback collection
- Manual labeling
- Custom evaluation pipelines

### Integrations
The platform integrates with many LLM tools and frameworks:
- OpenAI
- LangChain
- LlamaIndex
- Haystack
- LiteLLM
- Various model providers (AWS Bedrock, Anthropic, etc.)

## Development Workflow

The project uses:
- pnpm for package management
- Turbo for monorepo build orchestration
- Docker for containerization
- GitHub Actions for CI/CD
- Conventional commits

Local development setup requires:
- Node.js 20
- pnpm v9.5.0
- Docker
- Cloning the repository and running `pnpm run dx`

## Database Structure

The application uses two primary databases:
1. **PostgreSQL** (via Prisma)
   - Projects, users, authentication
   - Traces and observations
   - Prompts and evaluations

2. **ClickHouse**
   - Analytics data
   - High-performance trace querying

## Deployment Options

The platform can be deployed in various ways:
1. **Hanzo Cloud** - Managed SaaS offering
2. **Self-hosting**
   - Local (Docker Compose)
   - Kubernetes (Helm)
   - VM (Docker Compose)
   - Cloud provider-specific (AWS, GCP, Azure)

## Integration Points

Key integration points for connecting applications:
- **SDK** for Python and JS/TS
- **OpenAI** integration (drop-in replacement)
- **LangChain** and **LlamaIndex** integrations
- **API** endpoints for direct integration

## Build & Deploy Architecture

### Docker Images
| Dockerfile | Purpose | Registry | Entrypoint |
|---|---|---|---|
| `web/Dockerfile` | Production web (turbo prune, adaptive memory) | Docker Hub + GHCR | `entrypoint.sh` (auto-migrations) |
| `worker/Dockerfile` | Worker service | GHCR | `entrypoint.sh` |
| `Dockerfile` (root) | Local dev/fallback only | N/A | tini |

### CI Workflows
- `pipeline.yml` - Primary CI: lint, test (sharded), docker build test, e2e
- `deploy.yml` - Docker Hub push → Hanzo Platform webhook deploy
- `build-and-push.yml` - GHCR push (web + worker separately)
- `test.yml` - REMOVED (was outdated Node 20/pnpm 8, superseded by pipeline.yml)

### Key Build Optimizations
- `web/Dockerfile` uses `turbo prune --scope=web` for minimal Docker context
- `DOCKER_BUILD=1` env skips env.mjs validation AND Sentry webpack plugin
- `--max-old-space-size-percentage=75` for adaptive memory (no hardcoded OOM)
- BuildKit cache mounts for pnpm store and .next/cache
- Frontend deploys independently from backend/datastore

## Dependency Audit Notes

### Removed (confirmed 0 imports)
- @mui/material, @mui/x-tree-view, @heroicons/react, @remixicon/react
- @radix-ui/react-icons, @headlessui/react, @headlessui/tailwindcss

### Deduplicated via pnpm overrides (root package.json)
- date-fns, vis-network, posthog-js

### Multi-Tenancy Audit (2026-02-14)

Five cross-tenant data leakage risks identified and fixed:

1. **tenant-headers.ts: Arbitrary org fallback** -- `resolveOrgProjectFromSession` fell back to `user.organizations[0]` when no explicit orgId was on the session. For multi-org users this silently picked the wrong org's ID for `x-org-id`/`x-tenant-id` headers forwarded to downstream services (agents, compute, KMS).
   - Fix: Only use explicitly-set session context values (orgId/projectId from middleware).

2. **tenant-headers.ts: Untrusted client headers forwarded** -- `buildProxyTenantHeaders` seeded from client-supplied `x-org-id`, `x-project-id`, `x-tenant-id` request headers as defaults. A malicious client could inject arbitrary tenant IDs.
   - Fix: Start with empty tenant headers; only populate from server-side session.

3. **Proxy routes (agents, compute, KMS): Header injection** -- All three proxy routes forwarded ALL client request headers to upstream, including `x-org-id`, `x-project-id`, `x-tenant-id`, `x-actor-id`. Even after tenant-headers fix, these could survive if session didn't override.
   - Fix: Strip tenant headers from client request before applying session-derived values.

4. **surveys.ts: Unvalidated orgId** -- `surveysRouter.create` accepted arbitrary `orgId` from client input without checking the user's org membership. Survey data could be associated with any org.
   - Fix: Validate orgId against `ctx.session.user.organizations`; silently drop if not a member.

5. **scores.ts: Unscoped user lookup** -- User findMany in scores.all fetched user names/images by ID without scoping to the project's organization, potentially leaking user PII across tenant boundaries.
   - Fix: Added `organizationMemberships.some` filter scoped to the project's org.

Architecture notes:
- tRPC routers are well-protected: `protectedProjectProcedure` and `protectedOrganizationProcedure` enforce membership checks via middleware in `trpc.ts`
- All Prisma queries in routers filter by `projectId` or `orgId` from verified session context
- ClickHouse queries consistently use `projectId` for tenant isolation
- The main risk surface was the proxy layer (tenant-headers + proxy routes) and `authenticatedProcedure` routes that accept orgId in input without validating membership

### Known Bloat (future optimization)
- `@tremor/react` (4.0.0-beta) - 15 imports, overlaps with recharts. Migrate to recharts + custom Radix components.
- `@hanzo/ui` exists at ~/work/hanzo/ui but console doesn't use it. 64 local shadcn components duplicate @hanzo/ui's 90+ components.
- `packages/shared/src/index.ts` barrel exports (96 re-exports) kill tree-shaking. Should split into `@hanzo/shared/utils`, `@hanzo/shared/types`, etc.
- Only 5 dynamic imports across 67 feature directories. Heavy features (agents: 3MB, trace-graph-view) should be lazy-loaded.
- `vis-network` (45MB, 1 file) and `@deck.gl` (45MB, 1 file) are candidates for dynamic import.
