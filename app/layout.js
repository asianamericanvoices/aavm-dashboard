import './globals.css'

export const metadata = {
  title: 'AAVM Dashboard',
  description: 'Asian American Voices Media Content Management Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
