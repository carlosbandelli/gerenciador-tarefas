import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ATRIBUTO_ID_DA_TAREFA } from "../constantes";
import { Button } from "@/components/ui/button";

type Props = {
  id?: string;
  titulo: string;
  // Exclusão em andamento (vem do hook de dados).
  excluindo: boolean;
  // Dispara a exclusão. O pai chama `aoConcluir` quando termina (sucesso OU erro): é aí que o
  // diálogo fecha. No sucesso o item some e o diálogo desmonta junto.
  onConfirmar: (aoConcluir: () => void) => void;
};

// Apresentação: confirma a exclusão. O `open` é estado de UI local; a exclusão em si é do pai.
export function ExcluirTarefaDialog({ id, titulo, excluindo, onConfirmar }: Props) {
  const [aberto, setAberto] = useState(false);
  // Cobre o intervalo entre o clique e o `excluindo` chegar por props.
  const [enviando, setEnviando] = useState(false);
  const ocupado = excluindo || enviando;

  // Fallback: se a exclusão terminou (excluindo true -> false) e o `aoConcluir` não veio, fecha.
  const eraExcluindo = useRef(excluindo);
  useEffect(() => {
    if (eraExcluindo.current && !excluindo && enviando) {
      setEnviando(false);
      setAberto(false);
    }
    eraExcluindo.current = excluindo;
  }, [excluindo, enviando]);

  const aoMudar = (abrir: boolean) => {
    // Não fecha (Esc, clique fora, Cancelar) enquanto exclui.
    if (!abrir && ocupado) return;
    setAberto(abrir);
  };

  const confirmar = () => {
    // `aria-disabled` (e não `disabled`) mantém o foco; o clique é ignorado aqui.
    if (ocupado) return;
    setEnviando(true);
    onConfirmar(() => {
      setEnviando(false);
      setAberto(false);
    });
  };

  return (
    <AlertDialog open={aberto} onOpenChange={aoMudar}>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="sm"
            aria-label={`Excluir ${titulo}`}
            {...{ [ATRIBUTO_ID_DA_TAREFA]: id }}
          />
        }
      >
        Excluir
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir “{titulo}”?</AlertDialogTitle>
          <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel aria-disabled={ocupado} className="aria-disabled:opacity-50">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            aria-disabled={ocupado}
            className="aria-disabled:opacity-50"
            onClick={confirmar}
          >
            {ocupado ? "Excluindo…" : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
