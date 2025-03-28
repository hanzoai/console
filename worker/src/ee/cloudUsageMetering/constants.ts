export const cloudUsageMeteringDbCronJobName = 'cloudUsageMetering';

export enum CloudUsageMeteringDbCronJobStates {
  Starting = 'starting',
  Running = 'running',
  Error = 'error',
  Finished = 'finished',
}
