import { upsertDefaultModelPrices } from "./scripts/upsertDefaultModelPrices";
import { upsertManagedEvaluators } from "./scripts/upsertManagedEvaluators";
import { upsertHanzoDashboards } from "./scripts/upsertHanzoDashboards";

upsertDefaultModelPrices();
upsertManagedEvaluators();
upsertHanzoDashboards();
