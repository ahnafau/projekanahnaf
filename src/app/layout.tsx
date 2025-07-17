import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "L'Oréal Sales Assistant",
  description: 'Professional sales management platform for L\'Oréal representatives in Indonesia',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
          {children}
        </div>
      </body>
    </html>
  )
}