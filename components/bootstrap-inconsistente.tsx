import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function BootstrapInconsistente() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-m3-surface p-4">
      <Card className="w-full max-w-lg" role="alert">
        <CardHeader>
          <CardTitle className="text-xl text-m3-error">
            Instalação inconsistente
          </CardTitle>
          <CardDescription>
            O GerontiCare encontrou uma configuração inicial incompleta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-m3-on-surface-variant">
          <p>O acesso foi bloqueado para evitar perda ou duplicação de dados.</p>
          <p>
            Restaure um backup consistente ou revise os registros da instalação
            antes de reiniciar o serviço.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
