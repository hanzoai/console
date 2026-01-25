import { createTransport } from "nodemailer";
import { parseConnectionUrl } from "nodemailer/lib/shared/index.js";
import { render } from "@react-email/render";

import { BatchExportSuccessEmailTemplate } from "./BatchExportSuccessEmailTemplate";
import { logger } from "../../../logger";

type SendBatchExportSuccessParams = {
  env: Partial<
    Record<"EMAIL_FROM_ADDRESS" | "SMTP_CONNECTION_URL", string | undefined>
  >;
  receiverEmail: string;
  downloadLink: string;
  userName: string;
  batchExportName: string;
};

export const sendBatchExportSuccessEmail = async ({
  env,
  receiverEmail,
  downloadLink,
  userName,
  batchExportName,
}: SendBatchExportSuccessParams) => {
  if (!env.SMTP_CONNECTION_URL) {
    logger.error("Missing SMTP_CONNECTION_URL environment variable for sending email.");
    return;
  }
  const emailFromAddress = env.EMAIL_FROM_ADDRESS ?? "nonreply@hanzo.ai";

  try {
    const mailer = createTransport(parseConnectionUrl(env.SMTP_CONNECTION_URL));
    const htmlTemplate = await render(
      BatchExportSuccessEmailTemplate({
        receiverEmail,
        downloadLink,
        userName,
        batchExportName,
      }),
    );

    await mailer.sendMail({
      to: receiverEmail,
      from: {
        address: emailFromAddress,
        name: "HanzoCloud",
      },
      subject: "Your data export is ready",
      html: htmlTemplate,
    });
  } catch (error) {
    logger.error(error);
  }
};
