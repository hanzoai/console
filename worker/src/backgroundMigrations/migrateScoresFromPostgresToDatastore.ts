import { IBackgroundMigration } from "./IBackgroundMigration";
import { datastoreClient, convertPostgresScoreToInsert, logger } from "@hanzo/shared/src/server";
import { parseArgs } from "node:util";
import { prisma, Prisma } from "@hanzo/shared/src/db";
import { env } from "../env";

// This is hard-coded in our migrations and uniquely identifies the row in background_migrations table
const backgroundMigrationId = "94e50334-50d3-4e49-ad2e-9f6d92c85ef7";

export default class MigrateScoresFromPostgresToDatastore implements IBackgroundMigration {
  private isAborted = false;
  private isFinished = false;

  async validate(
    args: Record<string, unknown>,
    attempts = 5,
  ): Promise<{ valid: boolean; invalidReason: string | undefined }> {
    // Check if Datastore credentials are configured
    if (!env.DATASTORE_URL || !env.DATASTORE_USER || !env.DATASTORE_PASSWORD) {
      return {
        valid: false,
        invalidReason: "Datastore credentials must be configured to perform migration",
      };
    }

    // Check if Datastore scores table exists
    const tables = await datastoreClient().query({
      query: "SHOW TABLES",
    });
    const tableNames = (await tables.json()).data as { name: string }[];
    if (!tableNames.some((r) => r.name === "scores")) {
      // Retry if the table does not exist as this may mean migrations are still pending
      if (attempts > 0) {
        logger.info(`Datastore scores table does not exist. Retrying in 10s...`);
        return new Promise((resolve) => {
          setTimeout(() => resolve(this.validate(args, attempts - 1)), 10_000);
        });
      }

      // If all retries are exhausted, return as invalid
      return {
        valid: false,
        invalidReason: "Datastore scores table does not exist",
      };
    }

    return { valid: true, invalidReason: undefined };
  }

  async run(args: Record<string, unknown>): Promise<void> {
    const start = Date.now();
    logger.info(`Migrating scores from postgres to datastore with ${JSON.stringify(args)}`);

    // @ts-ignore
    const initialMigrationState: { state: { maxDate: string | undefined } } =
      await prisma.backgroundMigration.findUniqueOrThrow({
        where: { id: backgroundMigrationId },
        select: { state: true },
      });

    const maxRowsToProcess = Number(args.maxRowsToProcess ?? Infinity);
    const batchSize = Number(args.batchSize ?? 1000);
    const maxDate = initialMigrationState.state?.maxDate
      ? new Date(initialMigrationState.state.maxDate)
      : new Date((args.maxDate as string) ?? new Date());

    await prisma.backgroundMigration.update({
      where: { id: backgroundMigrationId },
      data: { state: { maxDate } },
    });

    let processedRows = 0;
    while (!this.isAborted && !this.isFinished && processedRows < maxRowsToProcess) {
      const fetchStart = Date.now();

      // @ts-ignore
      const migrationState: { state: { maxDate: string } } = await prisma.backgroundMigration.findUniqueOrThrow({
        where: { id: backgroundMigrationId },
        select: { state: true },
      });

      const scores = await prisma.$queryRaw<Array<Record<string, any>>>(Prisma.sql`
        SELECT id, timestamp, project_id, trace_id, observation_id, name, value, source, comment, author_user_id, config_id, data_type, string_value, queue_id, created_at, updated_at
        FROM scores
        WHERE created_at <= ${new Date(migrationState.state.maxDate)}
        ORDER BY created_at DESC
        LIMIT ${batchSize};
      `);
      if (scores.length === 0) {
        logger.info("No more scores to migrate. Exiting...");
        break;
      }

      logger.info(`Got ${scores.length} records from Postgres in ${Date.now() - fetchStart}ms`);

      const insertStart = Date.now();
      await datastoreClient().insert({
        table: "scores",
        values: scores.map(convertPostgresScoreToInsert),
        format: "JSONEachRow",
      });

      logger.info(`Inserted ${scores.length} scores into Datastore in ${Date.now() - insertStart}ms`);

      await prisma.backgroundMigration.update({
        where: { id: backgroundMigrationId },
        data: {
          state: {
            maxDate: new Date(scores[scores.length - 1].created_at),
          },
        },
      });

      if (scores.length < batchSize) {
        logger.info("No more scores to migrate. Exiting...");
        this.isFinished = true;
      }

      processedRows += scores.length;
      logger.info(
        `Processed batch in ${Date.now() - fetchStart}ms. Oldest record in batch: ${new Date(scores[scores.length - 1].created_at).toISOString()}`,
      );
    }

    if (this.isAborted) {
      logger.info(
        `Migration of scores from Postgres to Datastore aborted after processing ${processedRows} rows. Skipping cleanup.`,
      );
      return;
    }

    logger.info(`Finished migration of scores from Postgres to Datastore in ${Date.now() - start}ms`);
  }

  async abort(): Promise<void> {
    logger.info(`Aborting migration of scores from Postgres to datastore`);
    this.isAborted = true;
  }
}

async function main() {
  const args = parseArgs({
    options: {
      batchSize: { type: "string", short: "b", default: "1000" },
      maxRowsToProcess: { type: "string", short: "r", default: "Infinity" },
      maxDate: {
        type: "string",
        short: "d",
        default: new Date().toISOString(),
      },
    },
  });

  const migration = new MigrateScoresFromPostgresToDatastore();
  await migration.validate(args.values);
  await migration.run(args.values);
}

// If the script is being executed directly (not imported), run the main function
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`Migration execution failed: ${error}`);
      process.exit(1); // Exit with an error code
    });
}
