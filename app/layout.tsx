import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const SITE_URL = 'https://seafloor.pages.dev'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Seafloor — EU Shipping Emissions Globe',
  description:
    'Interactive 3D globe visualizing seven years of EU shipping emissions data (2018–2024) from THETIS-MRV. 12,000+ vessels per year, filterable by ship type, flag state, and emissions metrics.',
  applicationName: 'Seafloor',
  authors: [{ name: 'Marco Haber' }],
  creator: 'Marco Haber',
  keywords: [
    'shipping emissions',
    'EU MRV',
    'THETIS-MRV',
    'maritime emissions',
    'EU ETS',
    'data visualization',
    '3D globe',
    'CII rating',
  ],
  openGraph: {
    title: 'Seafloor — EU Shipping Emissions Globe',
    description:
      'Interactive 3D globe visualizing seven years of EU shipping emissions data (2018–2024) from THETIS-MRV. 12,000+ vessels per year.',
    url: SITE_URL,
    siteName: 'Seafloor',
    images: [
      {
        url: '/og.png',
        width: 1193,
        height: 630,
        alt: 'Seafloor — 3D globe showing EU shipping emissions data points across the world',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seafloor — EU Shipping Emissions Globe',
    description:
      'Interactive 3D globe visualizing seven years of EU shipping emissions data (2018–2024) from THETIS-MRV.',
    images: [
      {
        url: '/og.png',
        width: 1193,
        height: 630,
        alt: 'Seafloor — 3D globe showing EU shipping emissions data points across the world',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  appleWebApp: {
    title: 'Seafloor',
    statusBarStyle: 'black-translucent',
    capable: true,
  },
  category: 'Data Visualization',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Seafloor',
    url: SITE_URL,
    description:
      'Interactive 3D globe visualizing seven years of EU shipping emissions data (2018–2024) from THETIS-MRV.',
    applicationCategory: 'DataVisualization',
    operatingSystem: 'All',
    browserRequirements: 'Requires JavaScript and WebGL',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Person',
      name: 'Marco Haber',
    },
    about: {
      '@type': 'Dataset',
      name: 'THETIS-MRV EU Shipping Emissions',
      description:
        'EU shipping emissions data (2018–2024) from the THETIS-MRV monitoring, reporting, and verification system.',
      temporalCoverage: '2018/2024',
      creator: {
        '@type': 'Organization',
        name: 'European Maritime Safety Agency (EMSA)',
      },
    },
  }

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
