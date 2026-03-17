import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { LayoutDashboard, PlayCircle, ShieldCheck } from 'lucide-react';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Workflow Engine',
  description: 'Enterprise visual workflow automation engine.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-50 flex flex-col`}>
        
        {/* Navigation Bar */}
        <nav className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              <PlayCircle className="w-6 h-6 text-indigo-500" />
              FlowEngine
            </Link>

            <div className="flex items-center gap-6">
              <Link href="/workflows" className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Workflows
              </Link>
              <Link href="/audit" className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Audit Logs
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 container mx-auto px-4 py-8">
          {children}
        </main>

      </body>
    </html>
  );
}
