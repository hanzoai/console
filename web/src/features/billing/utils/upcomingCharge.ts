const fetchUpcomingCharge = async (orgId: string) => {
  if (!orgId) return null;
  const res = await fetch(`/api/billing/upcoming-charge?orgId=${orgId}`);
  if (!res.ok) return null;
  return res.json();
};


export default fetchUpcomingCharge;
