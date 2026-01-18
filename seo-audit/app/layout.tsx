import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SEO აუდიტი | 10xSEO',
  description: 'უფასო SEO აუდიტის ინსტრუმენტი - 50+ შემოწმება თქვენი ვებგვერდისთვის',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka">
      <body>{children}</body>
    </html>
  );
}
