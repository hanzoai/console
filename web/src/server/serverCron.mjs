import { PrismaClient } from "@hanzo/shared";
import cron from "node-cron";

const prisma = new PrismaClient();
let isScheduled = false;

export const scheduleCronJob = () => {
  console.log("Start cron");

  if (!isScheduled) {
    console.log("🚀 Starting Cron Job...");

    // Đặt lịch chạy mỗi ngày lúc 00:00
    // cron.schedule("0 0 * * *", async () => {
    cron.schedule("*/1 * * * *", async () => {
      console.log("✅ Cron Job is running every day at midnight");

      // Tính thời gian 90 ngày trước
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - 90);

      try {
        // Lấy danh sách organization có created_at < 90 ngày trước
        const organizations = await prisma.organization.findMany({
          where: {
            createdAt: {
              lte: dateThreshold, // lte: Less Than or Equal
            },
            credits: {
              not: 0, // Chỉ lấy những org có credits khác 0
            },
            OR: [
              {
                cloudConfig: undefined, // Không có cloudConfig
              },
              {
                cloudConfig: {
                  path: ["plan"], // Truy cập vào plan bên trong cloudConfig
                  not: {
                    contains: "free",
                    mode: "insensitive",
                  },
                },
              },
            ],
          },
        });
        console.log("check org:>>>", organizations);

        if (organizations.length > 0) {
          console.log(
            `🔍 Found ${organizations.length} organizations to update`,
          );

          // Cập nhật credits = 0
          const updateCount = await prisma.organization.updateMany({
            where: {
              id: {
                in: organizations.map((org) => org.id),
              },
            },
            data: {
              credits: 0,
            },
          });

          console.log(`✅ Updated ${updateCount.count} organizations`);
        } else {
          console.log("🚫 No organizations found to update");
        }
      } catch (error) {
        console.error("❌ Error during cron job execution:", error.message);
      }
    });

    isScheduled = true;
    console.log("✅ Cron Job Scheduled Successfully!");
  }
};
