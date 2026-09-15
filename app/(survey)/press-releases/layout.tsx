import { Noto_Sans_JP } from 'next/font/google';

const pressSans = Noto_Sans_JP({
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
    <div className={`press-doc ${pressSans.variable}`}>
      {children}
    </div>
  );
}
