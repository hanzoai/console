import { env } from "../env";

export const isEeAvailable: boolean =
  env.NEXT_PUBLIC_HANZO_CLOUD_REGION !== undefined ||
  env.HANZO_EE_LICENSE_KEY !== undefined;
