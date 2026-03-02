import { prisma } from "../../src/db";
import { redis } from "../../src/server";
import { prepareDatastore } from "./prepare-datastore";

async function main() {
  try {
    const projectIds = ["7a88fb47-b4e2-43b8-a06c-a5ce950dc53a"]; // Example project IDs
    if (
      await prisma.project.findFirst({
        where: { id: "239ad00f-562f-411d-af14-831c75ddd875" },
      })
    ) {
      projectIds.push("239ad00f-562f-411d-af14-831c75ddd875");
    }
    await prepareDatastore(projectIds, {
      numberOfDays: 3,
      numberOfRuns: 3,
    });

    console.log("Datastore preparation completed successfully.");
  } catch (error) {
    console.error("Error during Datastore preparation:", error);
  } finally {
    await prisma.$disconnect();
    redis?.disconnect();
    console.log("Disconnected from Datastore.");
  }
}

main();
