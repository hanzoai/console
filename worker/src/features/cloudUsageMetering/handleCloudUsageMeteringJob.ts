import { parseDbOrg } from "@hanzo/shared";
import { prisma } from "@hanzo/shared/src/db";
import { env } from "../../env";
import {
  CloudUsageMeteringQueue,
  getObservationCountsByProjectInCreationInterval,
  getScoreCountsByProjectInCreationInterval,
  getTraceCountsByProjectInCreationInterval,
  logger,
} from "@hanzo/shared/src/server";
import { cloudUsageMeteringDbCronJobName, CloudUsageMeteringDbCronJobStates } from "./constants";
import { QueueJobs, recordGauge, traceException } from "@hanzo/shared/src/server";
import { Job } from "bullmq";
import { backOff } from "exponential-backoff";

const delayFromStartOfInterval = 3600000 + 5 * 60 * 1000; // 5 minutes after the end of the interval

/**
 * POST a usage meter event to the Hanzo Commerce service.
 */
async function reportUsageToCommerce(params: {
  orgId: string;
  eventName: string;
  timestamp: number;
  value: number;
}): Promise<void> {
  const url = new URL("/usage/meter", env.COMMERCE_API_URL!);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.COMMERCE_SERVICE_TOKEN}`,
      "Content-Type": "application/json",
      "X-Org-ID": params.orgId,
    },
    body: JSON.stringify({
      event_name: params.eventName,
      timestamp: params.timestamp,
      value: params.value,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Commerce /usage/meter returned ${res.status}: ${body}`);
  }
}

export const handleCloudUsageMeteringJob = async (job: Job) => {
  if (!env.COMMERCE_API_URL || !env.COMMERCE_SERVICE_TOKEN) {
    logger.warn("[CLOUD USAGE METERING] Commerce API not configured");
    throw new Error("Commerce API not configured (COMMERCE_API_URL / COMMERCE_SERVICE_TOKEN)");
  }

  // Get cron job, create if it does not exist
  const cron = await prisma.cronJobs.upsert({
    where: { name: cloudUsageMeteringDbCronJobName },
    create: {
      name: cloudUsageMeteringDbCronJobName,
      state: CloudUsageMeteringDbCronJobStates.Queued,
      lastRun: new Date(Date.now() - ((Date.now() % 3600000) + 3600000)), // beginning of the last full hour
    },
    update: {},
  });
  if (!cron.lastRun) {
    logger.warn("[CLOUD USAGE METERING] Cron job last run not found");
    throw new Error("Cloud Usage Metering Cron Job last run not found");
  }
  if (cron.lastRun.getTime() % 3600000 !== 0) {
    logger.warn("[CLOUD USAGE METERING] Cron job last run is not on the full hour");
    throw new Error("Cloud Usage Metering Cron Job last run is not on the full hour");
  }
  if (cron.lastRun.getTime() + delayFromStartOfInterval > Date.now()) {
    logger.info(`[CLOUD USAGE METERING] Next Job is not due yet`);
    return;
  }

  if (cron.state === CloudUsageMeteringDbCronJobStates.Processing) {
    if (cron.jobStartedAt && cron.jobStartedAt < new Date(Date.now() - 1200000)) {
      logger.warn("[CLOUD USAGE METERING] Last job started at is older than 20 minutes, retrying job");
    } else {
      logger.warn("[CLOUD USAGE METERING] Job already in progress");
      return;
    }
  }

  try {
    await prisma.cronJobs.update({
      where: {
        name: cloudUsageMeteringDbCronJobName,
        state: cron.state,
        jobStartedAt: cron.jobStartedAt,
      },
      data: {
        state: CloudUsageMeteringDbCronJobStates.Processing,
        jobStartedAt: new Date(),
      },
    });
  } catch (e) {
    logger.warn("[CLOUD USAGE METERING] Failed to update cron job state, potential race condition, exiting", {
      e,
    });
    return;
  }

  // timing
  const meterIntervalStart = cron.lastRun;
  const meterIntervalEnd = new Date(cron.lastRun.getTime() + 3600000);
  logger.info(
    `[CLOUD USAGE METERING] Job running for interval ${meterIntervalStart.toISOString()} - ${meterIntervalEnd.toISOString()}`,
  );

  // find all organizations with billing configured
  const organizations = (
    await prisma.organization.findMany({
      where: {
        cloudConfig: {
          path: ["billing", "customerId"],
          not: { equals: null },
        },
      },
      include: {
        projects: {
          select: {
            id: true,
          },
        },
      },
    })
  ).map(({ projects, ...org }) => ({
    ...parseDbOrg(org),
    projectIds: projects.map((p) => p.id),
  }));
  logger.info(`[CLOUD USAGE METERING] Job for ${organizations.length} organizations`);

  const observationCountsByProject = await getObservationCountsByProjectInCreationInterval({
    start: meterIntervalStart,
    end: meterIntervalEnd,
  });
  const traceCountsByProject = await getTraceCountsByProjectInCreationInterval({
    start: meterIntervalStart,
    end: meterIntervalEnd,
  });
  const scoreCountsByProject = await getScoreCountsByProjectInCreationInterval({
    start: meterIntervalStart,
    end: meterIntervalEnd,
  });

  // for each org, calculate the meter and push to Commerce
  let countProcessedOrgs = 0;
  let countProcessedObservations = 0;
  let countProcessedEvents = 0;
  for (const org of organizations) {
    // update progress to prevent job from being stalled
    job.updateProgress(countProcessedOrgs / organizations.length);

    const customerId = org.cloudConfig?.billing?.customerId;
    if (!customerId) {
      traceException(`[CLOUD USAGE METERING] Billing customer id not found for org ${org.id}`);
      logger.error(`[CLOUD USAGE METERING] Billing customer id not found for org ${org.id}`);
      continue;
    }

    // Observations (legacy)
    const countObservations = observationCountsByProject
      .filter((p) => org.projectIds.includes(p.projectId))
      .reduce((sum, p) => sum + p.count, 0);

    logger.info(
      `[CLOUD USAGE METERING] Job for org ${org.id} - ${customerId} customer id - ${countObservations} observations`,
    );
    if (countObservations > 0) {
      await backOff(
        async () =>
          await reportUsageToCommerce({
            orgId: org.id,
            eventName: "tracing_observations",
            timestamp: meterIntervalEnd.getTime() / 1000,
            value: countObservations,
          }),
        {
          numOfAttempts: 3,
        },
      );
    }

    // Events
    const countScores = scoreCountsByProject
      .filter((p) => org.projectIds.includes(p.projectId))
      .reduce((sum, p) => sum + p.count, 0);
    const countTraces = traceCountsByProject
      .filter((p) => org.projectIds.includes(p.projectId))
      .reduce((sum, p) => sum + p.count, 0);
    const countEvents = countScores + countTraces + countObservations;
    logger.info(`[CLOUD USAGE METERING] Job for org ${org.id} - ${customerId} customer id - ${countEvents} events`);
    if (countEvents > 0) {
      await backOff(
        async () =>
          await reportUsageToCommerce({
            orgId: org.id,
            eventName: "tracing_events",
            timestamp: meterIntervalEnd.getTime() / 1000,
            value: countEvents,
          }),
        {
          numOfAttempts: 3,
        },
      );
    }

    countProcessedOrgs++;
    countProcessedObservations += countObservations;
    countProcessedEvents += countEvents;
  }

  recordGauge("cloud_usage_metering_processed_orgs", countProcessedOrgs, {
    unit: "organizations",
  });
  recordGauge("cloud_usage_metering_processed_observations", countProcessedObservations, {
    unit: "observations",
  });
  recordGauge("cloud_usage_metering_processed_events", countProcessedEvents, {
    unit: "events",
  });

  // update cron job
  await prisma.cronJobs.update({
    where: { name: cloudUsageMeteringDbCronJobName },
    data: {
      lastRun: meterIntervalEnd,
      state: CloudUsageMeteringDbCronJobStates.Queued,
      jobStartedAt: null,
    },
  });

  logger.info(
    `[CLOUD USAGE METERING] Job for interval ${meterIntervalStart.toISOString()} - ${meterIntervalEnd.toISOString()} completed`,
    {
      countProcessedOrgs,
      countProcessedObservations,
      countProcessedEvents,
    },
  );

  if (meterIntervalEnd.getTime() + delayFromStartOfInterval < Date.now()) {
    logger.info(`[CLOUD USAGE METERING] Enqueueing next Cloud Usage Metering Job to catch up `);
    recordGauge("cloud_usage_metering_scheduled_catchup_jobs", 1, {
      unit: "jobs",
    });
    await CloudUsageMeteringQueue.getInstance()?.add(QueueJobs.CloudUsageMeteringJob, {});
  }
};
