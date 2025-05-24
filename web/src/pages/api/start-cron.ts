import type { NextApiRequest, NextApiResponse } from "next";
import { scheduleCronJob } from "@/src/server/serverCron.mjs";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    console.log("🌐 API start-server called...");
    scheduleCronJob();
    res.status(200).json({ message: "Server started and Cron Job is active!" });
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}
