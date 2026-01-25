/**
 * Server cron jobs - stub for community edition.
 * Credit management is only available in the enterprise/cloud edition.
 */

let isScheduled = false;

export const scheduleCronJob = () => {
  if (!isScheduled) {
    console.log("🚀 Cron jobs disabled in community edition");
    isScheduled = true;
  }
};
