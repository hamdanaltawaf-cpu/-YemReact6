import type { Metadata, Viewport } from 'next';
import { Cairo, Lalezar, IBM_Plex_Mono } from 'next/font/google';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AppProvider } from '@/components/AppProvider';
import { AppOverlays } from '@/components/AppOverlays';
import { Pwa } from '@/components/Pwa';
import { listReactions } from '@/server/db';
import './globals.css';
const display = Lalezar({
  weight: '400',
  subsets: ['arabic'],
  variable: '--f-display',
  display: 'swap',
});
const body = Cairo({ subsets: ['arabic', 'latin'], variable: '--f-body', display: 'swap' });
const mono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--f-mono',
  display: 'swap',
});
const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: 'YemReact — الموقف يمني. والردّ جاهز.', template: '%s | يمن رياكت' },
  description: 'مكتبة رياكشنات يمنية بالموقف. عاين، احفظ، وخذ ردّك معك. خذها. حطها. يمنية.',
  applicationName: 'YemReact',
  manifest: '/manifest.webmanifest',
  openGraph: { type: 'website', locale: 'ar_YE', siteName: 'YemReact', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f1ea' };
export const dynamic = 'force-dynamic';
const boot = `try{var t=JSON.parse(localStorage.getItem('yr:theme')||'"system"');document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;var a=JSON.parse(localStorage.getItem('yr:accent')||'"#c1592e"');if(/^#[a-f0-9]{6}$/i.test(a))document.documentElement.style.setProperty('--accent',a);if(JSON.parse(localStorage.getItem('yr:motion')||'false'))document.documentElement.dataset.motion='reduce'}catch(e){}`;
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body id="top">
        <AppProvider initial={listReactions()}>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <AppOverlays />
          <Pwa />
        </AppProvider>
      </body>
    </html>
  );
}
