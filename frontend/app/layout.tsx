import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Transcribe AI - Transforma tu audio en conocimiento inteligente',
  description: 'Plataforma de transcripción y análisis de audio con IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
