import { BaseError } from "./BaseError";

export class LangfuseNotFoundError extends BaseError {
  constructor(description = "Not Found") {
    super("HanzoCloudNotFoundError", 404, description, true);
  }
}
