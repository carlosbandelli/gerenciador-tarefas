import type { TarefaId } from "./tarefa-id";

// Porta de geração de ids (o VO `TarefaId` só valida). Devolve o VO para que um gerador
// defeituoso falhe na própria implementação, não adiante no fluxo.
export interface GeradorDeId {
  gerar(): TarefaId;
}
