import { Button } from "@/components/ui/button";

// Mensagem genérica de propósito: o detalhe técnico do erro não é para o usuário.
export function ErroAoCarregar({ onTentarNovamente }: { onTentarNovamente: () => void }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
    >
      <p className="font-medium">Não foi possível carregar as tarefas</p>
      <Button variant="outline" onClick={onTentarNovamente}>
        Tentar novamente
      </Button>
    </div>
  );
}
