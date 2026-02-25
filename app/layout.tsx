import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Seafloor — EU Shipping Emissions Globe',
  description:
    'Interactive 3D globe visualizing seven years of EU shipping emissions data from THETIS-MRV.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
