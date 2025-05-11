import { env } from "@/src/env.mjs";
import { NextResponse } from "next/server";

export function middleware() {
  const url = `${env.NEXTAUTH_URL}/api/start-cron`;
  let isStart: boolean = false;

  if (!isStart) {
    fetch(url, {
      method: "GET",
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("🔥 Cron Job đã kích hoạt:", data.message);
      })
      .catch((error) => {
        console.error("❌ Lỗi khi kích hoạt cron:", error.message);
      });
    isStart = true;
  }

  return NextResponse.next();
}
