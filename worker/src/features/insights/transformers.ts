import { v5 } from "uuid";
import type {
  AnalyticsTraceEvent,
  AnalyticsGenerationEvent,
  AnalyticsScoreEvent,
  AnalyticsObservationEvent,
} from "@hanzo/console-core/src/server";

// UUID v5 namespace for Insights
const INSIGHTS_UUID_NAMESPACE = "0f6c91df-d035-4813-b838-9741ba38ef0b";

type InsightsEvent = {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
  timestamp: Date;
  uuid: string;
};

export const transformTraceForInsights = (trace: AnalyticsTraceEvent, projectId: string): InsightsEvent => {
  const uuid = v5(`${projectId}-${trace.console_id}`, INSIGHTS_UUID_NAMESPACE);

  // Extract insights_session_id and map to $session_id

  const { insights_session_id, mixpanel_session_id, ...otherProps } = trace;

  return {
    distinctId: trace.console_user_id ? (trace.console_user_id as string) : uuid,
    event: "hanzo trace",
    properties: {
      ...otherProps,
      $session_id: insights_session_id ?? null,
      // Insights-specific: add user profile enrichment or mark as anonymous
      ...(trace.console_user_id && trace.console_user_url
        ? {
            $set: {
              console_user_url: trace.console_user_url,
            },
          }
        : // Capture as anonymous Insights event (cheaper/faster)
          // https://insights.com/docs/data/anonymous-vs-identified-events?tab=Backend
          { $process_person_profile: false }),
    },
    timestamp: trace.timestamp as Date,
    uuid,
  };
};

export const transformGenerationForInsights = (
  generation: AnalyticsGenerationEvent,
  projectId: string,
): InsightsEvent => {
  const uuid = v5(`${projectId}-${generation.console_id}`, INSIGHTS_UUID_NAMESPACE);

  // Extract insights_session_id and map to $session_id

  const { insights_session_id, mixpanel_session_id, ...otherProps } = generation;

  return {
    distinctId: generation.console_user_id ? (generation.console_user_id as string) : uuid,
    event: "hanzo generation",
    properties: {
      ...otherProps,
      $session_id: insights_session_id ?? null,
      // Insights-specific: add user profile enrichment or mark as anonymous
      ...(generation.console_user_id && generation.console_user_url
        ? {
            $set: {
              console_user_url: generation.console_user_url,
            },
          }
        : // Capture as anonymous Insights event (cheaper/faster)
          // https://insights.com/docs/data/anonymous-vs-identified-events?tab=Backend
          { $process_person_profile: false }),
    },
    timestamp: generation.timestamp as Date,
    uuid,
  };
};

export const transformScoreForInsights = (score: AnalyticsScoreEvent, projectId: string): InsightsEvent => {
  const uuid = v5(`${projectId}-${score.console_id}`, INSIGHTS_UUID_NAMESPACE);

  // Extract insights_session_id and map to $session_id

  const { insights_session_id, mixpanel_session_id, ...otherProps } = score;

  return {
    distinctId: score.console_user_id ? (score.console_user_id as string) : uuid,
    event: "hanzo score",
    properties: {
      ...otherProps,
      $session_id: insights_session_id ?? null,
      // Insights-specific: add user profile enrichment or mark as anonymous
      ...(score.console_user_id && score.console_user_url
        ? {
            $set: {
              console_user_url: score.console_user_url,
            },
          }
        : // Capture as anonymous Insights event (cheaper/faster)
          // https://insights.com/docs/data/anonymous-vs-identified-events?tab=Backend
          { $process_person_profile: false }),
    },
    timestamp: score.timestamp as Date,
    uuid,
  };
};

export const transformEventForInsights = (event: AnalyticsObservationEvent, projectId: string): InsightsEvent => {
  const uuid = v5(`${projectId}-${event.console_id}`, INSIGHTS_UUID_NAMESPACE);

  // Extract insights_session_id and map to $session_id

  const { insights_session_id, mixpanel_session_id, ...otherProps } = event;

  return {
    distinctId: event.console_user_id ? (event.console_user_id as string) : uuid,
    event: "hanzo observation",
    properties: {
      ...otherProps,
      $session_id: insights_session_id ?? null,
      // Insights-specific: add user profile enrichment or mark as anonymous
      ...(event.console_user_id && event.console_user_url
        ? {
            $set: {
              console_user_url: event.console_user_url,
            },
          }
        : // Capture as anonymous Insights event (cheaper/faster)
          // https://insights.com/docs/data/anonymous-vs-identified-events?tab=Backend
          { $process_person_profile: false }),
    },
    timestamp: event.timestamp as Date,
    uuid,
  };
};
