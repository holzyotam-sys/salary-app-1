export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he">
      <body
        style={{
          margin: 0,
          fontFamily: 'Arial',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          direction: 'ltr',
        }}
      >
        {children}
      </body>
    </html>
  );
}