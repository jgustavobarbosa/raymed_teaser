import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RayMed - Alertas de Preços de Medicamentos',
  description: 'Sistema inteligente de monitoramento e alertas de preços de medicamentos',
  keywords: ['medicamentos', 'preços', 'alertas', 'farmácia', 'saúde'],
  authors: [{ name: 'RayMed Team' }],
  creator: 'RayMed',
  publisher: 'RayMed',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'RayMed - Alertas de Preços de Medicamentos',
    description: 'Sistema inteligente de monitoramento e alertas de preços de medicamentos',
    url: '/',
    siteName: 'RayMed',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RayMed - Alertas de Preços de Medicamentos',
    description: 'Sistema inteligente de monitoramento e alertas de preços de medicamentos',
    creator: '@raymed',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-background">
            {children}
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
