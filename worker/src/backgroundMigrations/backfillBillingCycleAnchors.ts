import { IBackgroundMigration } from "./IBackgroundMigration";
import { logger } from "@hanzo/console-core/src/server";
import { parseArgs } from "node:util";
import { prisma } from "@hanzo/console-core/src/db";
import { env } from "../env";

/**
 * Background migration to backfill billing cycle anchors for organizations.
 *
 * For all organizations without a cloudBillingCycleAnchor, sets it to the
 * organization createdAt date. Subscription-based anchors are now managed
 * by the Hanzo Commerce service.
 *
 * This migration is idempotent and can be safely re-run if interrupted.
 */
export default class BackfillBillingCycleAnchors implements IBackgroundMigration {
  private isAborted = false;

  async validate(_args: Record<string, unknown>): Promise<{ valid: boolean; invalidReason: string | undefined }> {
    if (!env.NEXT_PUBLIC_HANZO_CLOUD_REGION) {
      logger.info("[Background Migration] Not in cloud environment, migration will be skipped");
      return { valid: true, invalidReason: undefined };
    }
    return { valid: true, invalidReason: undefined };
  }

  async run(args: Record<string, unknown>): Promise<void> {
    const startTime = Date.now();
    logger.info(`[Background Migration] Starting billing cycle anchor backfill with args: ${JSON.stringify(args)}`);

    if (!env.NEXT_PUBLIC_HANZO_CLOUD_REGION) {
      logger.info("[Background Migration] Not in cloud environment, skipping migration");
      return;
    }

    try {
      const orgsToBackfill = await prisma.organization.findMany({
        where: {
          cloudBillingCycleAnchor: null,
        },
      });

      const total = orgsToBackfill.length;
      logger.info(`[Background Migration] Found ${total} organizations to backfill`);

      if (total === 0) {
        logger.info("[Background Migration] No organizations to backfill, migration complete");
        return;
      }

      if (this.isAborted) {
        logger.info("[Background Migration] Migration aborted before processing");
        return;
      }

      let backfilled = 0;
      let errors = 0;

      for (const org of orgsToBackfill) {
        if (this.isAborted) {
          logger.info(`[Background Migration] Migration aborted after processing ${backfilled} organizations`);
          return;
        }

        try {
          // Use organization createdAt as the billing cycle anchor
          await prisma.organization.update({
            where: { id: org.id },
            data: {
              cloudBillingCycleAnchor: org.createdAt,
            },
          });
          backfilled++;
          logger.debug(`[Background Migration] Backfilled ${org.id} with createdAt: ${org.createdAt}`);
        } catch (error) {
          errors++;
          logger.error(`[Background Migration] Failed to backfill ${org.id}`, {
            error,
            orgId: org.id,
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info(
        `[Background Migration] Billing cycle anchor backfill completed in ${duration}ms: ${backfilled}/${total} backfilled, ${errors} errors`,
      );
    } catch (error) {
      logger.error("[Background Migration] Billing cycle anchor backfill failed", {
        error,
      });
      throw error;
    }
  }

  async abort(): Promise<void> {
    logger.info("[Background Migration] Aborting BackfillBillingCycleAnchors migration");
    this.isAborted = true;
  }
}

async function main() {
  const args = parseArgs({
    options: {},
  });

  const migration = new BackfillBillingCycleAnchors();
  const { valid, invalidReason } = await migration.validate(args.values);

  if (!valid) {
    logger.error(`[Background Migration] Validation failed: ${invalidReason}`);
    throw new Error(`Validation failed: ${invalidReason}`);
  }

  await migration.run(args.values);
}

// If the script is being executed directly (not imported), run the main function
if (require.main === module) {
  main()
    .then(() => {
      logger.info("[Background Migration] Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`[Background Migration] Migration execution failed: ${error}`);
      process.exit(1);
    });
}
