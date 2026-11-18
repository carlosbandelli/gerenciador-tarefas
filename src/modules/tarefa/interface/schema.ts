// Sem `server-only` de propósito: o formulário (client) importa estes schemas via zodResolver,
// garantindo a mesma validação no navegador e no servidor.
import { z } from "zod";
import { DESCRICAO_MAX, MENSAGENS, TITULO_MAX } from "../domain/regras";

// Paginação é da borda (não é invariante do domínio): limites e mensagens ficam aqui.
export const LISTAR_LIMIT_MAX = 50;
export const LISTAR_LIMIT_PADRAO = 10;
const MENSAGENS_LISTAGEM = {
  cursorInvalido: "Cursor inválido",
  limiteNumero: "O limite deve ser um número",
  limiteInteiro: "O limite deve ser um inteiro",
  limiteMinimo: "O limite mínimo é 1",
  limiteMaximo: `O limite máximo é ${LISTAR_LIMIT_MAX}`,
} as const;

// Mensagens de tipo errado/ausente vão no construtor (`z.string({ error })`) em vez de `z.config`
// global: o efeito fica restrito a estes schemas e visível onde é usado.
export const tituloSchema = z
  .string({ error: MENSAGENS.tituloObrigatorio })
  .trim()
  .min(1, { error: MENSAGENS.tituloObrigatorio })
  .max(TITULO_MAX, { error: MENSAGENS.tituloMuitoLongo });

const descricaoTexto = z
  .string({ error: MENSAGENS.descricaoTexto })
  .trim()
  .max(DESCRICAO_MAX, { error: MENSAGENS.descricaoMuitoLonga });

// Criação: descrição vazia equivale a "sem descrição" (undefined).
export const descricaoSchema = descricaoTexto
  .transform((valor) => (valor === "" ? undefined : valor))
  .optional();

export const idTarefaSchema = z.object({
  id: z.uuid({ error: MENSAGENS.idInvalido }),
});

// Objetos não são `.strict()`: o Zod descarta chaves desconhecidas, então `id`/`dataCriacao`
// enviados pelo cliente na criação nem chegam ao servidor (ele é dono de ids e datas), sem
// transformar um campo a mais em erro 400.
export const criarTarefaSchema = z.object({
  titulo: tituloSchema,
  descricao: descricaoSchema,
});

// Atualização tem três estados para `descricao`:
//   undefined -> não alterar | null -> APAGAR (veio "" ou só espaços) | string -> novo valor.
// `null` torna "apagar" explícito e tipado; undefined não serve porque significaria "não alterar".
// A entrada também aceita `null`, tornando o parse idempotente: o RHF + zodResolver entrega a
// saída já transformada ({ descricao: null }) e a procedure valida de novo.
// Objeto só com `id` é aceito: é um no-op inofensivo e evita uma regra extra de validação
// cruzada que o formulário também teria de replicar.
export const atualizarTarefaSchema = z.object({
  id: idTarefaSchema.shape.id,
  titulo: tituloSchema.optional(),
  // `.nullable()` em vez de `z.union`: a união esconderia as mensagens pt-BR atrás de "Invalid input".
  descricao: descricaoTexto
    .nullable()
    .transform((valor) => (valor === "" ? null : valor))
    .optional(),
});

// `prefault({})` (não `default({})`): o valor entra ANTES da validação e passa pelos `.default`
// internos (limit 10); assim `listar()` sem input funciona. `default({})` pularia o parse.
export const listarTarefasSchema = z
  .object({
    cursor: z
      .string({ error: MENSAGENS_LISTAGEM.cursorInvalido })
      .min(1, { error: MENSAGENS_LISTAGEM.cursorInvalido })
      .optional(),
    limit: z
      .number({ error: MENSAGENS_LISTAGEM.limiteNumero })
      .int({ error: MENSAGENS_LISTAGEM.limiteInteiro })
      .min(1, { error: MENSAGENS_LISTAGEM.limiteMinimo })
      .max(LISTAR_LIMIT_MAX, { error: MENSAGENS_LISTAGEM.limiteMaximo })
      .default(LISTAR_LIMIT_PADRAO),
  })
  .prefault({});

// Entrada = o que o formulário (react-hook-form) manipula; saída = o que o servidor recebe.
export type CriarTarefaInput = z.input<typeof criarTarefaSchema>;
export type CriarTarefaOutput = z.output<typeof criarTarefaSchema>;
export type AtualizarTarefaInput = z.input<typeof atualizarTarefaSchema>;
export type AtualizarTarefaOutput = z.output<typeof atualizarTarefaSchema>;
export type IdTarefaInput = z.input<typeof idTarefaSchema>;
export type IdTarefaOutput = z.output<typeof idTarefaSchema>;
export type ListarTarefasInput = z.input<typeof listarTarefasSchema>;
export type ListarTarefasOutput = z.output<typeof listarTarefasSchema>;
