export const metadata = {
  title: "Hanzo Console",
  description: "AI-powered observability platform for LLM applications",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          defer
          src="https://analytics.hanzo.ai/script.js"
          data-website-id="7dce54ee-41f6-4751-96bf-fe005067c7c7"
          data-do-not-track="true"
          data-exclude-search="true"
        />
      </body>
    </html>
  );
}
