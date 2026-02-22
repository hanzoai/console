import { BaseError } from "./BaseError";

export class ConsoleNotFoundError extends BaseError {
  constructor(description = "Not Found") {
    super("HanzoCloudNotFoundError", 404, description, true);
  }
}
