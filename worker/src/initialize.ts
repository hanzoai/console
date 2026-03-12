import { upsertDefaultModelPrices } from "./scripts/upsertDefaultModelPrices";
import { upsertManagedEvaluators } from "./scripts/upsertManagedEvaluators";
import { upsertConsoleDashboards } from "./scripts/upsertConsoleDashboards";

upsertDefaultModelPrices();
upsertManagedEvaluators();
upsertConsoleDashboards();
