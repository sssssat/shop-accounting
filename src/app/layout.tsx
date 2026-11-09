import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai, Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const plexThai = IBM_Plex_Sans_Thai({ subsets: ['thai'], weight: ['400', '500', '600'], variable: '--font-thai', display: 'swap' });

export const metadata: Metadata = {
  title: 'บัญชีร้าน',
  description: 'รายรับจาก POS รายจ่าย รูปใบเสร็จ และรายงาน',
  robots: { index: false, follow: false },
  icons: { icon: '/icons/favicon-64.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${inter.variable} ${plexThai.variable}`}>
      <body className="font-sans text-[15px]">{children}</body>
    </html>
  );
}
