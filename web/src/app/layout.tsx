export const metadata = {
  title: "Hanzo Console",
  description: "AI-powered observability platform for LLM applications",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
