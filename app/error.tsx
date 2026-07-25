'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[GerontiCare Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-m3-background">
      <div className="max-w-md mx-auto px-margin-mobile text-center">
        <div className="w-16 h-16 rounded-full bg-m3-error-container flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-m3-error" />
        </div>
        <h1 className="text-headline-md text-m3-on-surface mb-2">Algo deu errado</h1>
        <p className="text-body-md text-m3-secondary mb-6">
          Ocorreu um erro inesperado. Nossa equipe foi notificada automaticamente.
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            className="gap-2 text-label-md bg-m3-primary text-m3-on-primary hover:bg-m3-primary-container hover:text-m3-on-primary-container"
          >
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-m3-lg text-label-md border border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-variant transition-colors"
          >
            Voltar ao início
          </Link>
        </div>
        {error.digest && (
          <p className="text-label-sm text-m3-secondary mt-4">
            Código de erro: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
