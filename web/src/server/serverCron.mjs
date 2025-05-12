import { PrismaClient } from "@hanzo/shared";
import cron from "node-cron";

const prisma = new PrismaClient();
let isScheduled = false;

export const scheduleCronJob = () => {
  console.log("Start cron");

  if (!isScheduled) {
    console.log("🚀 Starting Cron Job...");

    cron.schedule("0 0 * * *", async () => {
      // cron.schedule("*/1 * * * *", async () => {
      console.log("CRON RUNNNNNNNN");
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - 90);

      try {
        const organizations = await prisma.organization.findMany({
          where: {
            createdAt: {
              lte: dateThreshold,
            },
            credits: {
              not: 0,
            },
            OR: [
              {
                cloudConfig: undefined,
              },
              {
                cloudConfig: {
                  path: ["plan"],
                  not: {
                    contains: "free",
                    mode: "insensitive",
                  },
                },
              },
            ],
          },
        });

        if (organizations.length > 0) {
          console.log(
            `🔍 Found ${organizations.length} organizations to update`,
          );

          await prisma.organization.updateMany({
            where: {
              id: {
                in: organizations.map((org) => org.id),
              },
            },
            data: {
              credits: 0,
            },
          });
        } else {
          console.log("🚫 No organizations found to update");
        }
      } catch (err) {
        // pass loi
        console.error("❌ Error during cron job execution", err);
      }
    });

    isScheduled = true;
    console.log("✅ Cron Job Scheduled Successfully!");
  }
};
