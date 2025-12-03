import './globals.css';

export const metadata = {
  title: 'Bus Tracker',
  description: 'Real-time bus tracking system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
