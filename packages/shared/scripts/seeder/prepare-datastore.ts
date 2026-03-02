import { SeederOrchestrator } from "./utils/seeder-orchestrator";
import { SeederOptions } from "./utils/types";
import { logger } from "../../src/server";

/**
 * Datastore data preparation using the seeder abstraction.
 */
export const prepareDatastore = async (
  projectIds: string[],
  opts: {
    numberOfDays: number;
    numberOfRuns?: number;
  },
) => {
  logger.info(`Preparing Datastore for ${projectIds.length} projects and ${opts.numberOfDays} days.`);

  const formattedOpts: SeederOptions = {
    mode: "bulk",
    numberOfDays: opts.numberOfDays,
    numberOfRuns: opts.numberOfRuns || 1,
  };

  const orchestrator = new SeederOrchestrator();

  try {
    await orchestrator.executeFullSeed(projectIds, formattedOpts);
    logger.info("Datastore preparation completed successfully");
  } catch (error) {
    logger.error("Datastore preparation failed:", error);
    throw error;
  }
};
