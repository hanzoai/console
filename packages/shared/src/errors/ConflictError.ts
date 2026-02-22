import { BaseError } from "./BaseError";

export class ConsoleConflictError extends BaseError {
  constructor(description = "Conflict") {
    super("ConsoleConflictError", 409, description, true);
  }
}
