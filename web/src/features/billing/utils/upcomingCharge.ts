import { env } from "@/src/env.mjs";

const fetchUpcomingCharge = async (orgId: string) => {
  if (!orgId) return null;
  const res = await fetch(
    `${env.NEXTAUTH_URL}/api/billing/upcoming-charge?orgId=${orgId}`,
  );
  if (!res.ok) return null;
  return res.json();
};

export default fetchUpcomingCharge;
