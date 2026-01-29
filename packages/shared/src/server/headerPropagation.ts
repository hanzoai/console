import * as opentelemetry from "@opentelemetry/api";
import type { IncomingHttpHeaders } from "http";
import { env } from "../env";

export type HanzoContextProps = {
  headers?: IncomingHttpHeaders;
  userId?: string;
  projectId?: string;
};

/**
 * Returns a new context containing baggage entries composed from
 * the supplied props (headers, userId, projectId). Existing baggage
 * entries are preserved.
 */
export const contextWithHanzoProps = (props: HanzoContextProps): opentelemetry.Context => {
  const ctx = opentelemetry.context.active();
  let baggage = opentelemetry.propagation.getBaggage(ctx) ?? opentelemetry.propagation.createBaggage();

  if (props.headers) {
    (env.HANZO_LOG_PROPAGATED_HEADERS as string[]).forEach((name) => {
      const value = props.headers![name];
      if (!value) return;
      const strValue = Array.isArray(value) ? JSON.stringify(value) : value;
      baggage = baggage.setEntry(`hanzo.header.${name}`, {
        value: strValue,
      });
    });

    // get x-hanzo-xxx headers and add them to the span
    Object.keys(props.headers).forEach((name) => {
      if (name.toLowerCase().startsWith("x-hanzo") || name.toLowerCase().startsWith("x_hanzo")) {
        const value = props.headers![name];
        if (!value) return;
        const strValue = Array.isArray(value) ? JSON.stringify(value) : value;
        baggage = baggage.setEntry(`hanzo.header.${name}`, {
          value: strValue,
        });
      }
    });
  }
  if (props.userId) {
    baggage = baggage.setEntry("hanzo.user.id", { value: props.userId });
  }
  if (props.projectId) {
    baggage = baggage.setEntry("hanzo.project.id", {
      value: props.projectId,
    });
  }

  return opentelemetry.propagation.setBaggage(ctx, baggage);
};
