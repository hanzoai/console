import { type ModelParams, type UIModelParams } from "@hanzo/shared";

export function getFinalModelParams(modelParams: UIModelParams): ModelParams {
  return Object.entries(modelParams)
    .filter(([key, value]) => value.enabled && key !== "maxTemperature")
    .reduce(
      (params, [key, value]) => ({ ...params, [key]: value.value }),
      {} as ModelParams,
    );
}
