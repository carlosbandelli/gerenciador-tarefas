// Invariantes do domínio. Sem imports de propósito: o schema Zod (borda) e os Value Objects
// leem DAQUI, então os limites e as mensagens nunca divergem entre as duas camadas.
// Paginação (limite, cursor) é preocupação da borda e vive em `interface/schema.ts`.

export const TITULO_MAX = 120;
export const DESCRICAO_MAX = 1000;

export const MENSAGENS = {
  tituloObrigatorio: "O título é obrigatório",
  tituloMuitoLongo: `O título deve ter no máximo ${TITULO_MAX} caracteres`,
  descricaoTexto: "A descrição deve ser um texto",
  descricaoMuitoLonga: `A descrição deve ter no máximo ${DESCRICAO_MAX} caracteres`,
  idInvalido: "Id de tarefa inválido",
  dataInvalida: "Data inválida",
  dataAtualizacaoAnterior: "A data de atualização não pode ser anterior à data de criação",
  tarefaNaoEncontrada: "Tarefa não encontrada",
} as const;

// Métrica de tamanho = a do Zod 4 em `.max()` de string: pontos de código Unicode, não unidades
// UTF-16 (ver `codePointLength` em zod/v4/core/util). Um emoji conta 1 (2 em `.length`), então
// 61 emojis cabem em 120 nos dois lados. Se divergisse, a borda aceitaria o que o domínio recusa
// (ou vice-versa). O teste em regras.test.ts compara as duas métricas.
export function tamanho(texto: string): number {
  return Array.from(texto).length;
}
