import type { Metadata } from 'next'
import { Inter, Geist } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Olivia Prado | Imóveis de Luxo e Lançamentos em Ponta Grossa',
  description: 'Encontre os melhores imóveis na planta, casas em condomínio e apartamentos de alto padrão em Ponta Grossa e região. Especialistas em bons investimentos.',
  keywords: 'imóveis ponta grossa, apartamento na planta, casa condomínio, olivia prado, imobiliária luxo',
  openGraph: {
    title: 'Olivia Prado - Real Estate Designer',
    description: 'Especialistas em lançamentos e imóveis de alto padrão.',
    url: 'https://oliviaprado.com.br',
    siteName: 'Olivia Prado',
    locale: 'pt_BR',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
