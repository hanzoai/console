import { env } from "@/src/env.mjs";

export const addDaysAndRoundToNextDay = (value: number): Date => {
  const now = new Date();

  const isDevOrStaging = env.NODE_ENV && env.NODE_ENV !== "production";
  // checking for prod
  console.log("Checkiing >>>", isDevOrStaging, env.NODE_ENV);
  if (isDevOrStaging) {
    // second for testing
    now.setSeconds(now.getSeconds() + value);
    return now;
  }

  // production mode
  now.setDate(now.getDate() + value);
  if (now.getHours() > 0 || now.getMinutes() > 0 || now.getSeconds() > 0) {
    now.setDate(now.getDate() + 1);
  }
  now.setHours(0, 0, 0, 0);
  return now;
};
