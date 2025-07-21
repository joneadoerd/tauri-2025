import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <head>
        <script src="http://localhost:8097"></script>
        </head>
      <body className={` antialiased`}>{children}</body>
    </html>
  );
}
