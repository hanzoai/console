import { z } from "zod/v4";
import { createTRPCRouter, authenticatedProcedure } from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { SurveyName } from "@prisma/client";
import { logger } from "@hanzo/shared/src/server";

const surveyResponseSchema = z.object({
  surveyName: z.nativeEnum(SurveyName),
  response: z.record(z.string(), z.string()),
  orgId: z.string().optional(),
});

export const surveysRouter = createTRPCRouter({
  create: authenticatedProcedure.input(surveyResponseSchema).mutation(async ({ ctx, input }) => {
    try {
      // Validate that the user is a member of the specified org to prevent
      // cross-tenant data association. If no orgId is provided, skip the check.
      let validatedOrgId = input.orgId;
      if (validatedOrgId) {
        const isMember = ctx.session.user.organizations.some(
          (org) => org.id === validatedOrgId,
        );
        if (!isMember) {
          // Silently drop the orgId rather than leaking membership info
          validatedOrgId = undefined;
        }
      }

      const survey = await ctx.prisma.survey.create({
        data: {
          surveyName: input.surveyName,
          response: input.response,
          userId: ctx.session.user.id,
          userEmail: ctx.session.user.email ?? undefined,
          orgId: validatedOrgId,
        },
      });

      return survey;
    } catch (error) {
      logger.error("Failed to call surveys.create", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to save survey response",
      });
    }
  }),
});
