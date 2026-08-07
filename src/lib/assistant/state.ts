import { classifyBackend, type BackendState } from '@hanzo/ui/product'

import { iamExpiresInSeconds } from '~/lib/auth/iam'

import { honest } from './state-core'

/**
 * The assistant's honest failure state: the shared classification of a thrown `/v1`
 * error, corrected for the one thing it cannot know — whether this session is live.
 * See `state-core` for why that correction exists.
 */
export const assistantState = (e: unknown): BackendState =>
  honest(classifyBackend(e), iamExpiresInSeconds())
