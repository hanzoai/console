import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const analyticsUrl = process.env.NEXT_PUBLIC_HANZO_ANALYTICS_URL || "https://a.hanzo.ai";
  const analyticsTrackerScript = process.env.NEXT_PUBLIC_HANZO_ANALYTICS_SCRIPT || "hanzo.js";

  return (
    <Html>
      <Head>
        {/* Inter Font - Hanzo Brand Typography */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
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