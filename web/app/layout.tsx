import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'wmweb · Object & Watermark Removal',
  description: 'Upload media, mark a region, and remove it server-side (LaMa / ProPainter / classical).',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
