import { BaseError } from "./BaseError";

export class HanzoNotFoundError extends BaseError {
  constructor(description = "Not Found") {
    super("HanzoCloudNotFoundError", 404, description, true);
  }
}
