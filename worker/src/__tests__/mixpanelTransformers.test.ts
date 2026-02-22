import { describe, it, expect } from "vitest";
import {
  transformTraceForMixpanel,
  transformGenerationForMixpanel,
  transformScoreForMixpanel,
  transformEventForMixpanel,
} from "../features/mixpanel/transformers";
import type {
  AnalyticsTraceEvent,
  AnalyticsGenerationEvent,
  AnalyticsScoreEvent,
  AnalyticsObservationEvent,
} from "@hanzo/shared/src/server";

describe("Mixpanel transformers", () => {
  const projectId = "test-project-id";

  describe("transformEventForMixpanel", () => {
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
        console_project_name: "Test Project",
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

      const result = transformEventForMixpanel(event, projectId);

      expect(result.event).toBe("[Console] Observation");
      expect(result.properties.distinct_id).toBe("user-789");
      expect(result.properties.$user_id).toBe("user-789");
      expect(result.properties.time).toBe(new Date("2024-01-15T10:00:00Z").getTime());
      expect(result.properties.$insert_id).toBeDefined();
      expect(result.properties.session_id).toBe("mixpanel-session-456");
      expect(result.properties.console_observation_name).toBe("test-event");
      expect(result.properties.console_trace_name).toBe("test-trace");
      expect(result.properties.console_model).toBe("gpt-4");
      expect(result.properties.console_type).toBe("GENERATION");
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
        console_project_name: "Test Project",
        console_user_id: null,
        console_event_version: "1.0.0",
        posthog_session_id: null,
        mixpanel_session_id: null,
      };

      const result = transformEventForMixpanel(event, projectId);

      expect(result.event).toBe("[Console] Observation");
      // distinct_id should be the generated $insert_id when no user_id
      expect(result.properties.distinct_id).toBe(result.properties.$insert_id);
      // Should not have $user_id for anonymous events
      expect(result.properties.$user_id).toBeUndefined();
      expect(result.properties.session_id).toBeUndefined();
    });

    it("should generate consistent insert IDs for the same event", () => {
      const event: AnalyticsObservationEvent = {
        console_id: "event-consistent",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_observation_name: "consistent-event",
        console_project_id: projectId,
        console_project_name: "Test Project",
        console_user_id: null,
        console_event_version: "1.0.0",
        posthog_session_id: null,
        mixpanel_session_id: null,
      };

      const result1 = transformEventForMixpanel(event, projectId);
      const result2 = transformEventForMixpanel(event, projectId);

      expect(result1.properties.$insert_id).toBe(result2.properties.$insert_id);
    });

    it("should use console_session_id when mixpanel_session_id is not available", () => {
      const event: AnalyticsObservationEvent = {
        console_id: "event-with-console-session",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_observation_name: "session-event",
        console_session_id: "console-session-123",
        console_project_id: projectId,
        console_project_name: "Test Project",
        console_user_id: "user-456",
        console_event_version: "1.0.0",
        posthog_session_id: null,
        mixpanel_session_id: null,
      };

      const result = transformEventForMixpanel(event, projectId);

      expect(result.properties.session_id).toBe("console-session-123");
    });

    it("should prefer mixpanel_session_id over console_session_id", () => {
      const event: AnalyticsObservationEvent = {
        console_id: "event-with-both-sessions",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_observation_name: "session-event",
        console_session_id: "console-session-123",
        console_project_id: projectId,
        console_project_name: "Test Project",
        console_user_id: "user-456",
        console_event_version: "1.0.0",
        posthog_session_id: "posthog-session-789",
        mixpanel_session_id: "mixpanel-session-456",
      };

      const result = transformEventForMixpanel(event, projectId);

      expect(result.properties.session_id).toBe("mixpanel-session-456");
    });

    it("should include console_project_name in properties", () => {
      const event: AnalyticsObservationEvent = {
        console_id: "event-with-project-name",
        timestamp: new Date("2024-01-15T10:00:00Z"),
        console_observation_name: "test-event",
        console_project_id: projectId,
        console_project_name: "My Custom Project Name",
        console_user_id: "user-123",
        console_event_version: "1.0.0",
        posthog_session_id: null,
        mixpanel_session_id: null,
      };

      const result = transformEventForMixpanel(event, projectId);

      expect(result.properties.console_project_name).toBe("My Custom Project Name");
    });
  });

  describe("transformTraceForMixpanel", () => {
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
        console_project_name: "Test Project",
        console_user_id: "user-789",
        console_latency: 2.5,
        console_release: "v1.0.0",
        console_version: "1",
        console_tags: ["tag1"],
        console_environment: "production",
        console_event_version: "1.0.0",
        posthog_session_id: null,
        mixpanel_session_id: "mixpanel-session-123",
      };

      const result = transformTraceForMixpanel(trace, projectId);

      expect(result.event).toBe("[Console] Trace");
      expect(result.properties.distinct_id).toBe("user-789");
      expect(result.properties.$user_id).toBe("user-789");
      expect(result.properties.session_id).toBe("mixpanel-session-123");
    });
  });

  describe("transformGenerationForMixpanel", () => {
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
        console_project_name: "Test Project",
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
        posthog_session_id: null,
        mixpanel_session_id: "mixpanel-session-456",
      };

      const result = transformGenerationForMixpanel(generation, projectId);

      expect(result.event).toBe("[Console] Generation");
      expect(result.properties.distinct_id).toBe("user-789");
      expect(result.properties.$user_id).toBe("user-789");
      expect(result.properties.session_id).toBe("mixpanel-session-456");
      expect(result.properties.console_model).toBe("gpt-4-turbo");
    });
  });

  describe("transformScoreForMixpanel", () => {
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
        console_project_name: "Test Project",
        console_user_id: "user-789",
        console_release: "v1.0.0",
        console_tags: ["human-eval"],
        console_environment: "production",
        console_event_version: "1.0.0",
        console_score_entity_type: "trace",
        console_dataset_run_id: null,
        posthog_session_id: null,
        mixpanel_session_id: "mixpanel-session-789",
      };

      const result = transformScoreForMixpanel(score, projectId);

      expect(result.event).toBe("[Console] Score");
      expect(result.properties.distinct_id).toBe("user-789");
      expect(result.properties.$user_id).toBe("user-789");
      expect(result.properties.session_id).toBe("mixpanel-session-789");
      expect(result.properties.console_score_name).toBe("quality");
      expect(result.properties.console_score_value).toBe(0.95);
    });
  });
});
