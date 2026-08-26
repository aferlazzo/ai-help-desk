import type { Metadata } from 'next';
import './globals.css';

const title = 'AI Help Desk — Friendly Technology Help';
const description = 'Dynamic, one-question-at-a-time troubleshooting for everyday technology problems.';
const image = 'https://ai-help-desk.aferlazzo.chatgpt.site/og.png';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title, description, images: [image] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
