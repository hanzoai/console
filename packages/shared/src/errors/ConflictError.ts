import { BaseError } from "./BaseError";

export class HanzoConflictError extends BaseError {
  constructor(description = "Conflict") {
    super("HanzoConflictError", 409, description, true);
  }
}
