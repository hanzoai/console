import { type EvalTemplate } from "@hanzo/shared";

// Define the type locally to match what's in @hanzo/shared
type VariableMapping = {
  templateVariable: string;
  consoleObject: "trace" | "generation" | "span" | "score" | "dataset_item";
  objectName?: string;
  selectedColumnId: string;
  jsonSelector?: string;
};

// Observation variable mapping (for event/experiment evaluators)
type ObservationVariableMapping = {
  templateVariable: string;
  selectedColumnId: string;
  jsonSelector?: string;
};

const defaultMappings = new Map<string, Partial<VariableMapping>>([
  // Common input variables (trace doesn't need objectName)
  [
    "input",
    {
      consoleObject: "trace",
      selectedColumnId: "input",
      objectName: undefined,
    },
  ],
  [
    "query",
    {
      consoleObject: "trace",
      selectedColumnId: "input",
      objectName: undefined,
    },
  ],
  [
    "question",
    {
      consoleObject: "trace",
      selectedColumnId: "input",
      objectName: undefined,
    },
  ],
  [
    "prompt",
    {
      consoleObject: "trace",
      selectedColumnId: "input",
      objectName: undefined,
    },
  ],

  // Common output variables (trace doesn't need objectName)
  [
    "output",
    {
      consoleObject: "trace",
      selectedColumnId: "output",
      objectName: undefined,
    },
  ],
  [
    "response",
    {
      consoleObject: "trace",
      selectedColumnId: "output",
      objectName: undefined,
    },
  ],
  [
    "answer",
    {
      consoleObject: "trace",
      selectedColumnId: "output",
      objectName: undefined,
    },
  ],
  [
    "completion",
    {
      consoleObject: "trace",
      selectedColumnId: "output",
      objectName: undefined,
    },
  ],

  // Common ground truth variables (dataset_item doesn't need objectName)
  [
    "expected_output",
    {
      consoleObject: "dataset_item",
      selectedColumnId: "expected_output",
      objectName: undefined,
    },
  ],
  [
    "ground_truth",
    {
      consoleObject: "dataset_item",
      selectedColumnId: "expected_output",
      objectName: undefined,
    },
  ],
  [
    "reference",
    {
      consoleObject: "dataset_item",
      selectedColumnId: "expected_output",
      objectName: undefined,
    },
  ],
]);

// Default mappings for observation-based evaluators (event/experiment)
const observationDefaultMappings = new Map<string, Partial<ObservationVariableMapping>>([
  // Common input variables
  ["input", { selectedColumnId: "input" }],
  ["query", { selectedColumnId: "input" }],
  ["question", { selectedColumnId: "input" }],
  ["prompt", { selectedColumnId: "input" }],

  // Common output variables
  ["output", { selectedColumnId: "output" }],
  ["response", { selectedColumnId: "output" }],
  ["answer", { selectedColumnId: "output" }],
  ["completion", { selectedColumnId: "output" }],

  // Common ground truth variables (from experiment item)
  ["expected_output", { selectedColumnId: "experimentItemExpectedOutput" }],
  ["ground_truth", { selectedColumnId: "experimentItemExpectedOutput" }],
  ["reference", { selectedColumnId: "experimentItemExpectedOutput" }],
]);

/**
 * Creates default variable mappings for an evaluator template.
 * Used for trace/dataset evaluators (legacy).
 *
 * @param template - The evaluation template containing variables
 * @returns Array of variable mappings
 */
export function createDefaultVariableMappings(template: EvalTemplate): VariableMapping[] {
  if (!template.vars || template.vars.length === 0) {
    return [];
  }

  return template.vars.map((variable) => {
    // Check if we have a default mapping for this variable name
    const defaultMapping = defaultMappings.get(variable.toLowerCase());

    if (defaultMapping) {
      return {
        templateVariable: variable,
        consoleObject: defaultMapping.consoleObject || "dataset_item",
        selectedColumnId: defaultMapping.selectedColumnId || "expected_output",
        objectName: defaultMapping.objectName,
        jsonSelector: defaultMapping.jsonSelector,
      };
    }

    return {
      consoleObject: "dataset_item",
      templateVariable: variable,
      selectedColumnId: "expected_output",
      objectName: undefined,
      jsonSelector: undefined,
    };
  });
}

/**
 * Creates default variable mappings for observation-based evaluators (event/experiment).
 * Uses simplified schema without consoleObject.
 *
 * @param template - The evaluation template containing variables
 * @returns Array of observation variable mappings
 */
export function createDefaultObservationVariableMappings(template: EvalTemplate): ObservationVariableMapping[] {
  if (!template.vars || template.vars.length === 0) {
    return [];
  }

  return template.vars.map((variable) => {
    // Check if we have a default mapping for this variable name
    const defaultMapping = observationDefaultMappings.get(variable.toLowerCase());

    if (defaultMapping) {
      return {
        templateVariable: variable,
        selectedColumnId: defaultMapping.selectedColumnId || "experimentItemExpectedOutput",
        jsonSelector: defaultMapping.jsonSelector,
      };
    }

    return {
      templateVariable: variable,
      selectedColumnId: "experimentItemExpectedOutput",
    };
  });
}
