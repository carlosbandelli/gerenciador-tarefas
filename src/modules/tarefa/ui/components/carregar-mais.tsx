import { useCallback, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useVisivel } from "../hooks/use-visivel";

type Props = {
  temMais: boolean;
  // Buscando a PRÓXIMA página: só para o texto "Carregando mais…".
  carregando: boolean;
  // Qualquer fetch em andamento (inclui a reconciliação pós-exclusão): é o que trava a paginação,
  // porque `fetchNextPage` cancelaria o refetch em curso.
  ocupado: boolean;
  erro: boolean;
  // Muda quando a lista muda (ex.: quantidade de itens). Uma página em memória pode chegar entre
  // dois renders, sem `podeCarregar` oscilar; sem isto o sentinela continuaria visível e sem
  // nova notificação do observer.
  versaoDaLista?: unknown;
  onCarregarMais: () => void;
};

// Rodapé da lista: sentinela do infinite scroll + alternativa por botão (teclado/leitor de tela).
// Sem dados próprios: o container decide quando há mais, se está ocupado e se falhou.
export function CarregarMais({
  temMais,
  carregando,
  ocupado,
  erro,
  versaoDaLista,
  onCarregarMais,
}: Props) {
  const podeCarregar = temMais && !ocupado && !erro;
  // Retry: o erro persiste durante a nova tentativa; `carregando` tem prioridade na tela.
  const mostrarErro = erro && !carregando;

  const sentinela = useVisivel<HTMLDivElement>(
    () => {
      if (podeCarregar) onCarregarMais();
    },
    // `podeCarregar` muda ao fim de cada fetch: re-observa para disparar de novo se o
    // sentinela ainda estiver à vista.
    { rootMargin: "200px", reobservarQuando: `${podeCarregar}:${String(versaoDaLista)}` },
  );

  // Foco: o botão some na última página. Se ele tinha o foco, passa para a mensagem de fim (senão
  // o foco cai no <body>). O cleanup do ref roda ANTES de o nó sair do DOM, então ainda dá para
  // saber se ele estava focado.
  const botaoTinhaFoco = useRef(false);
  const fimRef = useRef<HTMLParagraphElement>(null);
  const botaoRef = useCallback((botao: HTMLButtonElement | null) => {
    if (!botao) return;
    return () => {
      botaoTinhaFoco.current = document.activeElement === botao;
    };
  }, []);
  useLayoutEffect(() => {
    if (!temMais && botaoTinhaFoco.current) {
      botaoTinhaFoco.current = false;
      fimRef.current?.focus();
    }
  }, [temMais]);

  const indisponivel = ocupado || carregando;
  const aoClicar = () => {
    // `aria-disabled` (e não `disabled`) mantém o foco no botão; o clique é ignorado aqui.
    if (!indisponivel) onCarregarMais();
  };

  return (
    <div className="mt-4 flex flex-col items-center gap-2 text-sm">
      {temMais ? <div ref={sentinela} aria-hidden="true" className="h-px w-full" /> : null}
      {mostrarErro ? <p role="alert">Não foi possível carregar mais tarefas.</p> : null}
      {/* Região viva SEMPRE montada: só o texto muda (leitores de tela anunciam a mudança). */}
      <p ref={fimRef} role="status" tabIndex={-1} className="text-muted-foreground outline-none">
        {carregando ? "Carregando mais…" : !temMais ? "Você viu todas as tarefas" : ""}
      </p>
      {temMais ? (
        <Button
          ref={botaoRef}
          variant="outline"
          aria-disabled={indisponivel}
          className="aria-disabled:opacity-50"
          onClick={aoClicar}
        >
          {mostrarErro ? "Tentar novamente" : "Carregar mais"}
        </Button>
      ) : null}
    </div>
  );
}
