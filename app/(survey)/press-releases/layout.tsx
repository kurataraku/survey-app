import { IBM_Plex_Sans_JP, Noto_Serif_JP } from 'next/font/google';

const pressSerif = Noto_Serif_JP({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-press-serif',
  display: 'swap',
});

const pressSans = IBM_Plex_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-press-sans',
  display: 'swap',
});

export default function PressReleasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`press-doc ${pressSerif.variable} ${pressSans.variable}`}>
      {children}
    </div>
  );
}
