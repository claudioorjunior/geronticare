import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SetupNaoAutorizado() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-m3-surface p-4">
      <Card className="w-full max-w-lg" role="alert">
        <CardHeader>
          <CardTitle className="text-xl text-m3-error">
            Configuração não autorizada
          </CardTitle>
          <CardDescription>
            Esta tela só pode ser aberta pelo instalador do GerontiCare.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-m3-on-surface-variant">
          Volte ao terminal e abra novamente o link de configuração.
        </CardContent>
      </Card>
    </main>
  );
}
