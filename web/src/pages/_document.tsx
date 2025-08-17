import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const analyticsUrl = process.env.NEXT_PUBLIC_HANZO_ANALYTICS_URL || "https://a.hanzo.ai";
  const analyticsTrackerScript = process.env.NEXT_PUBLIC_HANZO_ANALYTICS_SCRIPT || "hanzo.js";
  
  return (
    <Html>
      <Head>
        {/* Hanzo Analytics Tracking Script */}
        {process.env.NEXT_PUBLIC_HANZO_ANALYTICS_SITE_ID && (
          <script
            async
            defer
            data-website-id={process.env.NEXT_PUBLIC_HANZO_ANALYTICS_SITE_ID}
            src={`${analyticsUrl}/${analyticsTrackerScript}`}
            data-host-url={analyticsUrl}
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}