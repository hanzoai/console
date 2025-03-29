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
- NextJS 14 (pages router)
- React 18
- Tailwind CSS with shadcn/ui components
- tRPC for type-safe API interactions

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

## Next Steps for Analysis

1. Examine the web application structure to understand UI components and flow
2. Investigate the API structure and integration points
3. Look at the database schema to understand data relationships
4. Review trace ingestion and processing logic
5. Explore the evaluation and dataset management functionality
