import { v5 } from "uuid";
import type { AnalyticsTraceEvent, AnalyticsGenerationEvent, AnalyticsScoreEvent } from "@hanzo/shared/src/server";

// UUID v5 namespace for PostHog
const POSTHOG_UUID_NAMESPACE = "0f6c91df-d035-4813-b838-9741ba38ef0b";

type PostHogEvent = {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
  timestamp: Date;
  uuid: string;
};

export const transformTraceForPostHog = (trace: AnalyticsTraceEvent, projectId: string): PostHogEvent => {
  const uuid = v5(`${projectId}-${trace.hanzo_id}`, POSTHOG_UUID_NAMESPACE);

  // Extract posthog_session_id and map to $session_id

  const { posthog_session_id, mixpanel_session_id, ...otherProps } = trace;

  return {
    distinctId: trace.hanzo_user_id ? (trace.hanzo_user_id as string) : uuid,
    event: "hanzo trace",
    properties: {
      ...otherProps,
      $session_id: posthog_session_id ?? null,
      // PostHog-specific: add user profile enrichment or mark as anonymous
      ...(trace.hanzo_user_id && trace.hanzo_user_url
        ? {
            $set: {
              hanzo_user_url: trace.hanzo_user_url,
            },
          }
        : // Capture as anonymous PostHog event (cheaper/faster)
          // https://posthog.com/docs/data/anonymous-vs-identified-events?tab=Backend
          { $process_person_profile: false }),
    },
    timestamp: trace.timestamp as Date,
    uuid,
  };
};

export const transformGenerationForPostHog = (
  generation: AnalyticsGenerationEvent,
  projectId: string,
): PostHogEvent => {
  const uuid = v5(`${projectId}-${generation.hanzo_id}`, POSTHOG_UUID_NAMESPACE);

  // Extract posthog_session_id and map to $session_id

  const { posthog_session_id, mixpanel_session_id, ...otherProps } = generation;

  return {
    distinctId: generation.hanzo_user_id ? (generation.hanzo_user_id as string) : uuid,
    event: "hanzo generation",
    properties: {
      ...otherProps,
      $session_id: posthog_session_id ?? null,
      // PostHog-specific: add user profile enrichment or mark as anonymous
      ...(generation.hanzo_user_id && generation.hanzo_user_url
        ? {
            $set: {
              hanzo_user_url: generation.hanzo_user_url,
            },
          }
        : // Capture as anonymous PostHog event (cheaper/faster)
          // https://posthog.com/docs/data/anonymous-vs-identified-events?tab=Backend
          { $process_person_profile: false }),
    },
    timestamp: generation.timestamp as Date,
    uuid,
  };
};

export const transformScoreForPostHog = (score: AnalyticsScoreEvent, projectId: string): PostHogEvent => {
  const uuid = v5(`${projectId}-${score.hanzo_id}`, POSTHOG_UUID_NAMESPACE);

  // Extract posthog_session_id and map to $session_id

  const { posthog_session_id, mixpanel_session_id, ...otherProps } = score;

  return {
    distinctId: score.hanzo_user_id ? (score.hanzo_user_id as string) : uuid,
    event: "hanzo score",
    properties: {
      ...otherProps,
      $session_id: posthog_session_id ?? null,
      // PostHog-specific: add user profile enrichment or mark as anonymous
      ...(score.hanzo_user_id && score.hanzo_user_url
        ? {
            $set: {
              hanzo_user_url: score.hanzo_user_url,
            },
          }
        : // Capture as anonymous PostHog event (cheaper/faster)
          // https://posthog.com/docs/data/anonymous-vs-identified-events?tab=Backend
          { $process_person_profile: false }),
    },
    timestamp: score.timestamp as Date,
    uuid,
  };
};
