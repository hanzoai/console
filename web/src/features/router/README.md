# Hanzo Router

This feature integrates the Hanzo Router (LLM and MCP routing via the llm package) into cloud.hanzo.ai.

## Overview

The Hanzo Router provides:
- 100+ LLM provider routing and management
- Model Context Protocol (MCP) server management
- Virtual API key management
- Usage tracking and billing
- Team-based access control

## Architecture

```
cloud.hanzo.ai
    ↓
tRPC Client → Hanzo Router tRPC API
    ↓
Router Backend (Python/FastAPI)
    ↓
LLM Providers (OpenAI, Anthropic, etc.)
```

## Features

### 1. Models Management
- Configure and manage LLM models
- Test model configurations
- Set custom pricing
- Model-specific rate limits

### 2. Virtual Keys
- Create and manage API keys
- Set budgets and limits
- Track usage per key
- Team-based key sharing

### 3. MCP Tools
- Enable/disable MCP servers
- Configure tool permissions
- Monitor tool usage

### 4. Usage & Billing
- Real-time usage tracking
- Stripe integration for payments
- Credit-based billing
- Usage alerts

### 5. Teams & Organizations
- Team-based access control
- Organization hierarchy
- Member permissions

## Integration Points

1. **Authentication**: Uses IAM (iam.hanzo.ai) for SSO
2. **Observability**: Integrated with Langfuse for tracing
3. **Billing**: Connected to Stripe via cloud billing system
4. **Database**: Shared PostgreSQL with proper isolation

## UI Components

All UI components follow cloud.hanzo.ai design standards:
- shadcn/ui components
- Tailwind CSS styling
- Consistent color scheme
- Responsive design