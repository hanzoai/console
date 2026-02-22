import { describe, it, expect } from "vitest";
import {
  transformTraceForPostHog,
  transformGenerationForPostHog,
  transformScoreForPostHog,
  transformEventForPostHog,
} from "../features/posthog/transformers";
import type {
  AnalyticsTraceEvent,
  AnalyticsGenerationEvent,
  AnalyticsScoreEvent,
  AnalyticsObservationEvent,
} from "@hanzo/shared/src/server";

describe("PostHog transformers", () => {
  const projectId = "test-project-id";

  describe("transformEventForPostHog", () => {
    it("should transform an event with user_id", () => {
      const event: AnalyticsObservationEvent = {
        console_id: "event-123",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_observation_name: "test-event",
        console_trace_name: "test-trace",
        console_trace_id: "trace-456",
        console_url: "https://console.hanzo.ai/project/test/traces/trace-456?observation=event-123",
        console_user_url: "https://console.hanzo.ai/project/test/users/user-789",
        console_cost_usd: 0.001,
        console_input_units: 100,
        console_output_units: 50,
        console_total_units: 150,
        console_session_id: "session-abc",
        console_project_id: projectId,
        console_user_id: "user-789",
        console_latency: 1.5,
        console_time_to_first_token: 0.3,
        console_release: "v1.0.0",
        console_version: "1",
        console_model: "gpt-4",
        console_level: "DEFAULT",
        console_type: "GENERATION",
        console_tags: ["tag1", "tag2"],
        console_environment: "production",
        console_event_version: "1.0.0",
        posthog_session_id: "posthog-session-123",
        mixpanel_session_id: "mixpanel-session-456",
      };

      const result = transformEventForPostHog(event, projectId);

      expect(result.event).toBe("console observation");
      expect(result.distinctId).toBe("user-789");
      expect(result.timestamp).toEqual(new Date("2024-01-15T10:00:00Z"));
      expect(result.uuid).toBeDefined();
      expect(result.properties.$session_id).toBe("posthog-session-123");
      expect(result.properties.console_observation_name).toBe("test-event");
      expect(result.properties.console_trace_name).toBe("test-trace");
      expect(result.properties.console_model).toBe("gpt-4");
      expect(result.properties.console_type).toBe("GENERATION");
      expect(result.properties.$set).toEqual({
        console_user_url: "https://console.hanzo.ai/project/test/users/user-789",
      });
      // Should not include posthog_session_id or mixpanel_session_id in properties
      expect(result.properties.posthog_session_id).toBeUndefined();
      expect(result.properties.mixpanel_session_id).toBeUndefined();
    });

    it("should transform an anonymous event without user_id", () => {
      const event: AnalyticsObservationEvent = {
        console_id: "event-anonymous",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_observation_name: "anonymous-event",
        console_project_id: projectId,
        console_user_id: null,
        console_event_version: "1.0.0",
        posthog_session_id: null,
        mixpanel_session_id: null,
      };

      const result = transformEventForPostHog(event, projectId);

      expect(result.event).toBe("console observation");
      // distinctId should be the generated UUID when no user_id
      expect(result.distinctId).toBe(result.uuid);
      expect(result.properties.$session_id).toBeNull();
      // Should have $process_person_profile: false for anonymous events
      expect(result.properties.$process_person_profile).toBe(false);
      expect(result.properties.$set).toBeUndefined();
    });

    it("should generate consistent UUIDs for the same event", () => {
      const event: AnalyticsObservationEvent = {
        console_id: "event-consistent",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_observation_name: "consistent-event",
        console_project_id: projectId,
        console_user_id: null,
        console_event_version: "1.0.0",
        posthog_session_id: null,
        mixpanel_session_id: null,
      };

      const result1 = transformEventForPostHog(event, projectId);
      const result2 = transformEventForPostHog(event, projectId);

      expect(result1.uuid).toBe(result2.uuid);
    });

    it("should handle event with session_id but no user_id", () => {
      const event: AnalyticsObservationEvent = {
        console_id: "event-with-session",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_observation_name: "session-event",
        console_session_id: "session-123",
        console_project_id: projectId,
        console_user_id: null,
        console_event_version: "1.0.0",
        posthog_session_id: "posthog-session-abc",
        mixpanel_session_id: null,
      };

      const result = transformEventForPostHog(event, projectId);

      expect(result.properties.$session_id).toBe("posthog-session-abc");
      expect(result.properties.console_session_id).toBe("session-123");
      expect(result.properties.$process_person_profile).toBe(false);
    });
  });

  describe("transformTraceForPostHog", () => {
    it("should transform a trace with user_id", () => {
      const trace: AnalyticsTraceEvent = {
        console_id: "trace-123",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_trace_name: "test-trace",
        console_url: "https://console.hanzo.ai/project/test/traces/trace-123",
        console_user_url: "https://console.hanzo.ai/project/test/users/user-789",
        console_cost_usd: 0.01,
        console_count_observations: 5,
        console_session_id: "session-abc",
        console_project_id: projectId,
        console_user_id: "user-789",
        console_latency: 2.5,
        console_release: "v1.0.0",
        console_version: "1",
        console_tags: ["tag1"],
        console_environment: "production",
        console_event_version: "1.0.0",
        posthog_session_id: "posthog-session-123",
        mixpanel_session_id: null,
      };

      const result = transformTraceForPostHog(trace, projectId);

      expect(result.event).toBe("console trace");
      expect(result.distinctId).toBe("user-789");
      expect(result.properties.$session_id).toBe("posthog-session-123");
    });
  });

  describe("transformGenerationForPostHog", () => {
    it("should transform a generation with user_id", () => {
      const generation: AnalyticsGenerationEvent = {
        console_id: "gen-123",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_generation_name: "test-generation",
        console_trace_name: "test-trace",
        console_trace_id: "trace-456",
        console_url: "https://console.hanzo.ai/project/test/traces/trace-456?observation=gen-123",
        console_user_url: "https://console.hanzo.ai/project/test/users/user-789",
        console_cost_usd: 0.005,
        console_input_units: 200,
        console_output_units: 100,
        console_total_units: 300,
        console_session_id: "session-abc",
        console_project_id: projectId,
        console_user_id: "user-789",
        console_latency: 1.2,
        console_time_to_first_token: 0.2,
        console_release: "v1.0.0",
        console_version: "1",
        console_model: "gpt-4-turbo",
        console_level: "DEFAULT",
        console_tags: ["api"],
        console_environment: "staging",
        console_event_version: "1.0.0",
        posthog_session_id: "posthog-session-456",
        mixpanel_session_id: null,
      };

      const result = transformGenerationForPostHog(generation, projectId);

      expect(result.event).toBe("console generation");
      expect(result.distinctId).toBe("user-789");
      expect(result.properties.$session_id).toBe("posthog-session-456");
      expect(result.properties.console_model).toBe("gpt-4-turbo");
    });
  });

  describe("transformScoreForPostHog", () => {
    it("should transform a score with user_id", () => {
      const score: AnalyticsScoreEvent = {
        console_id: "score-123",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_score_name: "quality",
        console_score_value: 0.95,
        console_score_comment: "Good response",
        console_score_metadata: { source: "human" },
        console_score_string_value: null,
        console_score_data_type: "NUMERIC",
        console_trace_name: "test-trace",
        console_trace_id: "trace-456",
        console_user_url: "https://console.hanzo.ai/project/test/users/user-789",
        console_session_id: "session-abc",
        console_project_id: projectId,
        console_user_id: "user-789",
        console_release: "v1.0.0",
        console_tags: ["human-eval"],
        console_environment: "production",
        console_event_version: "1.0.0",
        console_score_entity_type: "trace",
        console_dataset_run_id: null,
        posthog_session_id: "posthog-session-789",
        mixpanel_session_id: null,
      };

      const result = transformScoreForPostHog(score, projectId);

      expect(result.event).toBe("console score");
      expect(result.distinctId).toBe("user-789");
      expect(result.properties.$session_id).toBe("posthog-session-789");
      expect(result.properties.console_score_name).toBe("quality");
      expect(result.properties.console_score_value).toBe(0.95);
    });
  });
});
