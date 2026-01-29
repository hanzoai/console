import { type EvalTemplate } from "@hanzo/shared";

// Define the type locally to match what's in @hanzo/shared
type VariableMapping = {
  templateVariable: string;
  hanzoObject: "trace" | "generation" | "span" | "score" | "dataset_item";
  objectName?: string;
  selectedColumnId: string;
  jsonSelector?: string;
};

const defaultMappings = new Map<string, Partial<VariableMapping>>([
  // Common input variables
  ["input", { hanzoObject: "trace", selectedColumnId: "input" }],
  ["query", { hanzoObject: "trace", selectedColumnId: "input" }],
  ["question", { hanzoObject: "trace", selectedColumnId: "input" }],
  ["prompt", { hanzoObject: "trace", selectedColumnId: "input" }],

  // Common output variables
  ["output", { hanzoObject: "trace", selectedColumnId: "output" }],
  ["response", { hanzoObject: "trace", selectedColumnId: "output" }],
  ["answer", { hanzoObject: "trace", selectedColumnId: "output" }],
  ["completion", { hanzoObject: "trace", selectedColumnId: "output" }],

  // Common ground truth variables
  [
    "expected_output",
    { hanzoObject: "dataset_item", selectedColumnId: "expected_output" },
  ],
  [
    "ground_truth",
    { hanzoObject: "dataset_item", selectedColumnId: "expected_output" },
  ],
  [
    "reference",
    { hanzoObject: "dataset_item", selectedColumnId: "expected_output" },
  ],
]);

/**
 * Creates default variable mappings for an evaluator template.
 *
 * @param template - The evaluation template containing variables
 * @returns Array of variable mappings
 */
export function createDefaultVariableMappings(
  template: EvalTemplate,
): VariableMapping[] {
  if (!template.vars || template.vars.length === 0) {
    return [];
  }

  return template.vars.map((variable) => {
    // Check if we have a default mapping for this variable name
    const defaultMapping = defaultMappings.get(variable.toLowerCase());

    if (defaultMapping) {
      return {
        templateVariable: variable,
        hanzoObject: defaultMapping.hanzoObject || "dataset_item",
        selectedColumnId: defaultMapping.selectedColumnId || "expected_output",
        objectName: defaultMapping.objectName,
        jsonSelector: defaultMapping.jsonSelector,
      };
    }

    return {
      hanzoObject: "dataset_item",
      templateVariable: variable,
      selectedColumnId: "expected_output",
    };
  });
}
