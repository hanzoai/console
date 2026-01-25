import { Role } from "@langfuse/shared";

export const orderedRoles: Record<Role, number> = {
  [Role.OWNER]: 5,
  [Role.ADMIN]: 4,
  [Role.ADMIN_BILLING]: 3,
  [Role.MEMBER]: 2,
  [Role.VIEWER]: 1,
  [Role.NONE]: 0,
};
