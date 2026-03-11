import { IBackgroundMigration } from "./IBackgroundMigration";
import { logger } from "@hanzo/console-core/src/server";
import { env } from "../env";

// This is hard-coded in our migrations and uniquely identifies the row in background_migrations table
// In this case it is not used as we will skip this migration and run the RMT migration instead
// const backgroundMigrationId = "8d47f91b-3e5c-4a26-9f85-c12d6e4b9a3d";

export default class MigrateDatasetRunItemsFromPostgresToDatastore implements IBackgroundMigration {
  async validate(): Promise<{
    valid: boolean;
    invalidReason: string | undefined;
  }> {
    // Check if Datastore credentials are configured
    if (!env.DATASTORE_URL || !env.DATASTORE_USER || !env.DATASTORE_PASSWORD) {
      return {
        valid: false,
        invalidReason: "Datastore credentials must be configured to perform migration",
      };
    }

    // Return true as we will skip this migration and run the RMT migration instead
    return { valid: true, invalidReason: undefined };
  }

  async run(): Promise<void> {
    logger.info(
      `Migration of dataset run items from postgres to datastore skipped as we will run the RMT migration instead`,
    );
  }

  async abort(): Promise<void> {
    logger.info(`Aborting migration of dataset run items from Postgres to datastore`);
  }
}

async function main() {
  const migration = new MigrateDatasetRunItemsFromPostgresToDatastore();
  await migration.validate();
  await migration.run();
}

// If the script is being executed directly (not imported), run the main function
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`Migration execution failed: ${error}`, error);
      process.exit(1); // Exit with an error code
    });
}
