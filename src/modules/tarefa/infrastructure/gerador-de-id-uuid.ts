import type { GeradorDeId } from "../domain/gerador-de-id";
import { TarefaId } from "../domain/tarefa-id";

// Usa o `crypto` GLOBAL (Node 19+, edge, browsers) em vez de `node:crypto`, para o código rodar
// em qualquer runtime. `randomUUID` gera v4, aceito pela validação de `TarefaId`.
export class GeradorDeIdUuid implements GeradorDeId {
  gerar(): TarefaId {
    return TarefaId.criar(crypto.randomUUID());
  }
}
