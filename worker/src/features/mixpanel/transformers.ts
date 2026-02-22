import { v5 } from "uuid";
import type {
  AnalyticsTraceEvent,
  AnalyticsGenerationEvent,
  AnalyticsScoreEvent,
  AnalyticsObservationEvent,
} from "@hanzo/shared/src/server";

// UUID v5 namespace for Mixpanel (different from PostHog)
const MIXPANEL_UUID_NAMESPACE = "8f7c3e42-9a1b-4d5f-8e2a-1c6b9d3f4e7a";

export type MixpanelEvent = {
  event: string;
  properties: {
    time: number; // milliseconds since epoch
    distinct_id: string;
    $insert_id: string;
    $user_id?: string;
    session_id?: string;
    [key: string]: unknown;
  };
};

export const transformTraceForMixpanel = (trace: AnalyticsTraceEvent, projectId: string): MixpanelEvent => {
  const insertId = v5(`${projectId}-${trace.hanzo_id}`, MIXPANEL_UUID_NAMESPACE);

  // Extract session IDs and exclude from properties

  const { posthog_session_id, mixpanel_session_id, ...otherProps } = trace;

  return {
    event: "[Hanzo] Trace",
    properties: {
      time: new Date(trace.timestamp as Date).getTime(),
      distinct_id: trace.hanzo_user_id ? (trace.hanzo_user_id as string) : insertId,
      $insert_id: insertId,
      ...(trace.hanzo_user_id ? { $user_id: trace.hanzo_user_id as string } : {}),
      session_id:
        mixpanel_session_id || trace.hanzo_session_id
          ? (mixpanel_session_id as string) || (trace.hanzo_session_id as string)
          : undefined,
      ...otherProps,
    },
  };
};

export const transformGenerationForMixpanel = (
  generation: AnalyticsGenerationEvent,
  projectId: string,
): MixpanelEvent => {
  const insertId = v5(`${projectId}-${generation.hanzo_id}`, MIXPANEL_UUID_NAMESPACE);

  // Extract session IDs and exclude from properties

  const { posthog_session_id, mixpanel_session_id, ...otherProps } = generation;

  return {
    event: "[Hanzo] Generation",
    properties: {
      time: new Date(generation.timestamp as Date).getTime(),
      distinct_id: generation.hanzo_user_id ? (generation.hanzo_user_id as string) : insertId,
      $insert_id: insertId,
      ...(generation.hanzo_user_id ? { $user_id: generation.hanzo_user_id as string } : {}),
      session_id:
        mixpanel_session_id || generation.hanzo_session_id
          ? (mixpanel_session_id as string) || (generation.hanzo_session_id as string)
          : undefined,
      ...otherProps,
    },
  };
};

export const transformScoreForMixpanel = (score: AnalyticsScoreEvent, projectId: string): MixpanelEvent => {
  const insertId = v5(`${projectId}-${score.hanzo_id}`, MIXPANEL_UUID_NAMESPACE);

  // Extract session IDs and exclude from properties

  const { posthog_session_id, mixpanel_session_id, ...otherProps } = score;

  return {
    event: "[Hanzo] Score",
    properties: {
      time: new Date(score.timestamp as Date).getTime(),
      distinct_id: score.hanzo_user_id ? (score.hanzo_user_id as string) : insertId,
      $insert_id: insertId,
      ...(score.hanzo_user_id ? { $user_id: score.hanzo_user_id as string } : {}),
      session_id:
        mixpanel_session_id || score.hanzo_session_id
          ? (mixpanel_session_id as string) || (score.hanzo_session_id as string)
          : undefined,
      ...otherProps,
    },
  };
};

export const transformEventForMixpanel = (event: AnalyticsObservationEvent, projectId: string): MixpanelEvent => {
  const insertId = v5(`${projectId}-${event.console_id}`, MIXPANEL_UUID_NAMESPACE);

  // Extract session IDs and exclude from properties

  const { posthog_session_id, mixpanel_session_id, ...otherProps } = event;

  return {
    event: "[Console] Observation",
    properties: {
      time: new Date(event.timestamp as Date).getTime(),
      distinct_id: event.console_user_id ? (event.console_user_id as string) : insertId,
      $insert_id: insertId,
      ...(event.console_user_id ? { $user_id: event.console_user_id as string } : {}),
      session_id:
        mixpanel_session_id || event.console_session_id
          ? (mixpanel_session_id as string) || (event.console_session_id as string)
          : undefined,
      ...otherProps,
    },
  };
};
