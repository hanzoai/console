import { createTracesCh, createTrace, getEnvironmentsForProject } from "@hanzo/console-core/src/server";
import { randomUUID } from "crypto";

describe("Datastore Project Repository Test", () => {
  it("should return default if no environments are found", async () => {
    const projectId = randomUUID();
    const environments = await getEnvironmentsForProject({ projectId });
    expect(environments).toHaveLength(1);
    expect(environments[0].environment).toEqual("default");
  });

  it("should return environment from project_environments table after new trace was inserted", async () => {
    const projectId = randomUUID();
    const environmentId1 = randomUUID();
    const environmentId2 = randomUUID();
    await createTracesCh([
      createTrace({
        project_id: projectId,
        environment: environmentId1,
      }),
      createTrace({
        project_id: projectId,
        environment: environmentId1,
      }),
      createTrace({
        project_id: projectId,
        environment: environmentId2,
      }),
    ]);

    const environments = await getEnvironmentsForProject({ projectId });

    expect(environments).toHaveLength(3);
    expect(environments).toEqual(
      expect.arrayContaining([
        { environment: environmentId1 },
        { environment: environmentId2 },
        { environment: "default" },
      ]),
    );
  });
});
