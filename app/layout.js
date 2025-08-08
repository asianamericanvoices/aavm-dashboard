export const metadata = {
  title: 'AAVM Dashboard',
  description: 'Asian American Voices Media Content Management Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
