import { Job } from "@hanzo/mq";
import { prisma } from "@hanzo/console-core/src/db";
import {
  QueueName,
  TQueueJobTypes,
  logger,
  getTracesForAnalyticsIntegrations,
  getGenerationsForAnalyticsIntegrations,
  getScoresForAnalyticsIntegrations,
  getEventsForAnalyticsIntegrations,
  getCurrentSpan,
  validateWebhookURL,
} from "@hanzo/console-core/src/server";
import {
  transformTraceForInsights,
  transformGenerationForInsights,
  transformEventForInsights,
  transformScoreForInsights,
} from "./transformers";
import { decrypt } from "@hanzo/console-core/encryption";
import { PostHog as Insights } from "posthog-node";

type InsightsExecutionConfig = {
  projectId: string;
  projectName: string;
  minTimestamp: Date;
  maxTimestamp: Date;
  decryptedInsightsApiKey: string;
  insightsHost: string;
};

const insightsSettings = {
  flushAt: 1000,
};

const processInsightsTraces = async (config: InsightsExecutionConfig) => {
  const traces = getTracesForAnalyticsIntegrations(
    config.projectId,
    config.projectName,
    config.minTimestamp,
    config.maxTimestamp,
  );

  logger.info(`[INSIGHTS] Sending traces for project ${config.projectId} to Insights`);

  // Send each via Insights SDK
  const insights = new Insights(config.decryptedInsightsApiKey, {
    host: config.insightsHost,
    ...insightsSettings,
  });

  let sendError: Error | undefined;
  insights.on("error", (error: unknown) => {
    logger.error(`[INSIGHTS] Error sending traces to Insights for project ${config.projectId}: ${error}`);
    sendError = error instanceof Error ? error : new Error(String(error));
  });

  let count = 0;
  for await (const trace of traces) {
    if (sendError) throw sendError;
    count++;
    const event = transformTraceForInsights(trace, config.projectId);
    insights.capture(event);
    if (count % 10000 === 0) {
      await insights.flush();
      if (sendError) throw sendError;
      logger.info(`[INSIGHTS] Sent ${count} traces to Insights for project ${config.projectId}`);
    }
  }
  await insights.flush();
  if (sendError) throw sendError;
  logger.info(`[INSIGHTS] Sent ${count} traces to Insights for project ${config.projectId}`);
};

const processInsightsGenerations = async (config: InsightsExecutionConfig) => {
  const generations = getGenerationsForAnalyticsIntegrations(
    config.projectId,
    config.projectName,
    config.minTimestamp,
    config.maxTimestamp,
  );

  logger.info(`[INSIGHTS] Sending generations for project ${config.projectId} to Insights`);

  // Send each via Insights SDK
  const insights = new Insights(config.decryptedInsightsApiKey, {
    host: config.insightsHost,
    ...insightsSettings,
  });

  let sendError: Error | undefined;
  insights.on("error", (error: unknown) => {
    logger.error(`[INSIGHTS] Error sending generations to Insights for project ${config.projectId}: ${error}`);
    sendError = error instanceof Error ? error : new Error(String(error));
  });

  let count = 0;
  for await (const generation of generations) {
    if (sendError) throw sendError;
    count++;
    const event = transformGenerationForInsights(generation, config.projectId);
    insights.capture(event);
    if (count % 10000 === 0) {
      await insights.flush();
      if (sendError) throw sendError;
      logger.info(`[INSIGHTS] Sent ${count} generations to Insights for project ${config.projectId}`);
    }
  }
  await insights.flush();
  if (sendError) throw sendError;
  logger.info(`[INSIGHTS] Sent ${count} generations to Insights for project ${config.projectId}`);
};

const processInsightsScores = async (config: InsightsExecutionConfig) => {
  const scores = getScoresForAnalyticsIntegrations(
    config.projectId,
    config.projectName,
    config.minTimestamp,
    config.maxTimestamp,
  );

  logger.info(`[INSIGHTS] Sending scores for project ${config.projectId} to Insights`);

  // Send each via Insights SDK
  const insights = new Insights(config.decryptedInsightsApiKey, {
    host: config.insightsHost,
    ...insightsSettings,
  });

  let sendError: Error | undefined;
  insights.on("error", (error: unknown) => {
    logger.error(`[INSIGHTS] Error sending scores to Insights for project ${config.projectId}: ${error}`);
    sendError = error instanceof Error ? error : new Error(String(error));
  });

  let count = 0;
  for await (const score of scores) {
    if (sendError) throw sendError;
    count++;
    const event = transformScoreForInsights(score, config.projectId);
    insights.capture(event);
    if (count % 10000 === 0) {
      await insights.flush();
      if (sendError) throw sendError;
      logger.info(`[INSIGHTS] Sent ${count} scores to Insights for project ${config.projectId}`);
    }
  }
  await insights.flush();
  if (sendError) throw sendError;
  logger.info(`[INSIGHTS] Sent ${count} scores to Insights for project ${config.projectId}`);
};

const processInsightsEvents = async (config: InsightsExecutionConfig) => {
  const events = getEventsForAnalyticsIntegrations(
    config.projectId,
    config.projectName,
    config.minTimestamp,
    config.maxTimestamp,
  );

  logger.info(`[INSIGHTS] Sending events for project ${config.projectId} to Insights`);

  // Send each via Insights SDK
  const insights = new Insights(config.decryptedInsightsApiKey, {
    host: config.insightsHost,
    ...insightsSettings,
  });

  let sendError: Error | undefined;
  insights.on("error", (error: unknown) => {
    logger.error(`[INSIGHTS] Error sending events to Insights for project ${config.projectId}: ${error}`);
    sendError = error instanceof Error ? error : new Error(String(error));
  });

  let count = 0;
  for await (const analyticsEvent of events) {
    if (sendError) throw sendError;
    count++;
    const event = transformEventForInsights(analyticsEvent, config.projectId);
    insights.capture(event);
    if (count % 10000 === 0) {
      await insights.flush();
      logger.info(`[INSIGHTS] Sent ${count} events to Insights for project ${config.projectId}`);
    }
  }
  await insights.flush();
  if (sendError) throw sendError;
  logger.info(`[INSIGHTS] Sent ${count} events to Insights for project ${config.projectId}`);
};

export const handleInsightsIntegrationProjectJob = async (
  job: Job<TQueueJobTypes[QueueName.InsightsIntegrationProcessingQueue]>,
) => {
  const projectId = job.data.payload.projectId;

  const span = getCurrentSpan();
  if (span) {
    span.setAttribute("messaging.bullmq.job.input.jobId", job.data.id);
    span.setAttribute("messaging.bullmq.job.input.projectId", projectId);
  }

  logger.info(`[INSIGHTS] Processing Insights integration for project ${projectId}`);

  // Fetch Insights integration information for project
  const insightsIntegration = await prisma.insightsIntegration.findFirst({
    where: {
      projectId,
      enabled: true,
    },
    include: {
      project: {
        select: { name: true },
      },
    },
  });

  if (!insightsIntegration) {
    logger.warn(`[INSIGHTS] Enabled Insights integration not found for project ${projectId}`);
    return;
  }

  if (!insightsIntegration.project) {
    logger.warn(`[INSIGHTS] Project not found for Insights integration ${projectId}`);
    return;
  }

  // Validate Insights hostname to prevent SSRF attacks before sending data
  try {
    await validateWebhookURL(insightsIntegration.insightsHostName);
  } catch (error) {
    logger.error(
      `[INSIGHTS] Insights integration for project ${projectId} has invalid hostname: ${insightsIntegration.insightsHostName}. Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw new Error(
      `Invalid Insights hostname for project ${projectId}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Fetch relevant data and send it to Insights
  const executionConfig: InsightsExecutionConfig = {
    projectId,
    projectName: insightsIntegration.project.name,
    // Start from 2000-01-01 if no lastSyncAt. Workaround because 1970-01-01 leads to subtle bugs in Datastore
    minTimestamp: insightsIntegration.lastSyncAt || new Date("2000-01-01"),
    maxTimestamp: new Date(new Date().getTime() - 30 * 60 * 1000), // 30 minutes ago
    decryptedInsightsApiKey: decrypt(insightsIntegration.encryptedInsightsApiKey),
    insightsHost: insightsIntegration.insightsHostName,
  };

  try {
    const processPromises: Promise<void>[] = [];

    // Always include scores
    processPromises.push(processInsightsScores(executionConfig));

    // Traces and observations - for TRACES_OBSERVATIONS and TRACES_OBSERVATIONS_EVENTS
    if (
      insightsIntegration.exportSource === "TRACES_OBSERVATIONS" ||
      insightsIntegration.exportSource === "TRACES_OBSERVATIONS_EVENTS"
    ) {
      processPromises.push(processInsightsTraces(executionConfig), processInsightsGenerations(executionConfig));
    }

    // Events - for EVENTS and TRACES_OBSERVATIONS_EVENTS
    if (
      insightsIntegration.exportSource === "EVENTS" ||
      insightsIntegration.exportSource === "TRACES_OBSERVATIONS_EVENTS"
    ) {
      processPromises.push(processInsightsEvents(executionConfig));
    }

    await Promise.all(processPromises);

    // Update the last run information for the insightsIntegration record.
    await prisma.insightsIntegration.update({
      where: {
        projectId,
      },
      data: {
        lastSyncAt: executionConfig.maxTimestamp,
      },
    });
    logger.info(`[INSIGHTS] Insights integration processing complete for project ${projectId}`);
  } catch (error) {
    logger.error(`[INSIGHTS] Error processing Insights integration for project ${projectId}`, error);
    throw error;
  }
};
