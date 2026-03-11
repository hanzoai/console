import { CommentObjectType, type CreateCommentData } from "@hanzo/console-core";
import { type z } from "zod/v4";
import { getObservationById, getTraceById } from "@hanzo/console-core/src/server";

const isObservationOrTrace = (objectType: CommentObjectType) => {
  return objectType === CommentObjectType.OBSERVATION || objectType === CommentObjectType.TRACE;
};

export const validateCommentReferenceObject = async ({
  ctx,
  input,
}: {
  ctx: any;
  input: z.infer<typeof CreateCommentData>;
}): Promise<{ errorMessage?: string }> => {
  const { objectId, objectType, projectId } = input;

  if (isObservationOrTrace(objectType)) {
    let datastoreObject;
    if (objectType === CommentObjectType.OBSERVATION) {
      datastoreObject = await getObservationById({
        id: objectId,
        projectId,
      });
    } else {
      datastoreObject = await getTraceById({
        traceId: objectId,
        projectId,
      });
    }

    return !!datastoreObject
      ? {}
      : {
          errorMessage: `Reference object, ${objectType}: ${objectId} not found in Datastore. Skipping creating comment.`,
        };
  } else {
    const prismaModel =
      objectType === CommentObjectType.SESSION
        ? "traceSession"
        : objectType === CommentObjectType.PROMPT
          ? "prompt"
          : null;

    if (!prismaModel) {
      return {
        errorMessage: `No prisma model for object type ${objectType}`,
      };
    }

    const model = ctx.prisma[prismaModel];
    const object = await model.findFirst({
      where: {
        id: objectId,
        projectId,
      },
    });

    if (!object) {
      return {
        errorMessage: `No ${prismaModel} with id ${objectId} in project ${projectId}`,
      };
    }
    return {};
  }
};
