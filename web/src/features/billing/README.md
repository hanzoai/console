# Billing

## Overview

Billing powers subscriptions and usage-based pricing for organizations via the Hanzo Commerce service. All payment-provider operations are delegated to Commerce, which manages per-org credentials and namespace-isolated billing.

## Key Concepts

- **Organizations**: Entities within the product that can have multiple projects.
- **Projects**: Sub-entities under organizations where usage is tracked.
- **Observations**: Units of usage (API calls), tracked at project level and aggregated for billing per organization.

## Implementation Details

### API Surface (TRPC)

See `web/src/ee/features/billing/server/cloudBillingRouter.ts`.

- `getSubscriptionInfo` — live cancellation/scheduled-change info.
- `createCheckoutSession` — starts checkout for a product from the catalogue.
- `changeSubscriptionProduct` — switches plan (upgrade now, downgrade at period end).
- `cancelSubscription` / `reactivateSubscription` — manage cancellation flags.
- `clearPlanSwitchSchedule` — releases any active/not-started schedule.
- `getCustomerPortalUrl` — portal for payment methods, tax IDs, invoices (not for plan switches).
- `getInvoices` — paginated invoice list with subscription/usage/tax breakdown and preview row.

### Checkout and Subscription Management

Implemented in `web/src/ee/features/billing/server/billingService.ts`.

1. **Checkout**
   - Initiated from billing settings; only products from the catalogue are allowed.
   - Commerce service handles checkout session creation with plan + usage items.
   - Metadata carries `orgId` and `cloudRegion`.

2. **Plan Changes**
   - Upgrades: immediate price swap with proration invoiced now; release any schedules first.
   - Downgrades: create a subscription schedule to switch at current period end; release existing schedules first.
   - Legacy handling: migrate classic subscriptions to flexible; replace single metered item with plan+usage or vice versa.

3. **Cancellation / Reactivation**
   - Cancel sets `cancel_at_period_end`; reactivate clears cancellation flags.
   - Both release any active/not-started subscription schedules first.

4. **Cloud Config**
   - `cloudConfig.stripe`: `customerId`, `activeSubscriptionId`, `activeProductId`, `activeUsageProductId`.
   - Entitlements derive from `activeProductId` and catalogue mapping.
   - If `plan` is set (manual override), creating/changing subscriptions is blocked until removed.

### Usage-Based Pricing

1. **Usage Meter**
   - Usage is tracked at the customer level via a meter on the usage item.
   - The worker reports usage periodically for all orgs with an active customer.

2. **Hourly Job**
   - Runs in the worker (`cloudUsageMeteringQueue`).
   - Aggregates last-hour observations and posts to Commerce usage endpoint.
   - Governed by BullMQ repeatables and `cron_jobs` table to ensure singleton execution/backfill.

### Webhooks

Webhooks are handled by the Hanzo Commerce service directly. The console no longer processes billing webhooks.

## Testing

1. Prepare an organization in your environment (local or staging)
2. Use Commerce service test endpoints for checkout and subscription management
3. Exercise scenarios: change subscriptions from the UI, verify invoices/alerts

## Current Limitations

- The Billing Portal cannot be used for plan switches. Plan changes must go through our API. The client shows an alert explaining implications but does not present a dedicated checkout page for switching plans.
