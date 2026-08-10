'use client';

import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-m3-background">
      <div className="max-w-md mx-auto px-margin-mobile text-center">
        <div className="w-16 h-16 rounded-full bg-m3-surface-container-high flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="h-8 w-8 text-m3-secondary" />
        </div>
        <h1 className="text-headline-md text-m3-on-surface mb-2">Página não encontrada</h1>
        <p className="text-body-md text-m3-secondary mb-6">
          A página que você procura não existe ou foi movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-m3-lg text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container transition-colors"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}
