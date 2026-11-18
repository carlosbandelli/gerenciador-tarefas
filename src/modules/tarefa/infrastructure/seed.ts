import type { GeradorDeId } from "../domain/gerador-de-id";
import { Tarefa } from "../domain/tarefa";

// Todos os dados abaixo são FICTÍCIOS (exigência do enunciado): sem nomes reais, e-mails ou
// empresas. Cada item é [título, descrição?]; vários não têm descrição de propósito.
const EXEMPLOS: readonly (readonly [titulo: string, descricao?: string])[] = [
  ["Planejar a semana", "Listar as prioridades e reservar blocos de tempo para cada uma."],
  ["Revisar as anotações"],
  ["Organizar a mesa de trabalho", "Separar o que é útil e guardar o resto."],
  ["Estudar padrões de projeto", "Começar por Repository e Factory, com exemplos pequenos."],
  ["Escrever o resumo do capítulo"],
  ["Preparar a apresentação", "Slides curtos, um exemplo ao vivo e tempo para perguntas."],
  ["Fazer a lista de compras"],
  ["Agendar a revisão do projeto", "Escolher um horário com pouca interrupção."],
  ["Limpar a caixa de entrada"],
  ["Atualizar o diário de bordo", "Registrar o que funcionou e o que precisa melhorar."],
  ["Testar o fluxo de cadastro"],
  ["Corrigir o texto do botão", "A mensagem estava confusa para quem usa pela primeira vez."],
  ["Montar o roteiro da viagem fictícia"],
  ["Ler um artigo sobre acessibilidade", "Anotar três ideias aplicáveis à interface."],
  ["Regar as plantas"],
  ["Medir o tempo de carregamento", "Comparar antes e depois da otimização de imagens."],
  ["Escrever testes para o caso de borda"],
  ["Planejar o jantar de domingo", "Escolher o cardápio e conferir os ingredientes."],
  ["Revisar as permissões de acesso"],
  ["Desenhar o esboço da tela inicial", "Duas versões: uma compacta e uma espaçosa."],
  ["Responder as mensagens pendentes"],
  ["Praticar uma caminhada de trinta minutos", "Sem celular, só para espairecer."],
  ["Documentar as decisões de arquitetura"],
  ["Consertar a prateleira da sala", "Comprar parafusos novos antes."],
  ["Fazer o backup dos arquivos de exemplo"],
];

type Parametros = {
  quantidade?: number;
  // A mais recente recebe exatamente esta data; as demais, 1 minuto a menos cada.
  agora: Date;
  geradorDeId: GeradorDeId;
};

// Função pura (sem relógio nem aleatoriedade próprios): data e ids entram por parâmetro, então
// a ordem da listagem é determinística. Se `quantidade` passar do banco de textos, os títulos
// se repetem com um sufixo numérico.
export function criarTarefasDeExemplo({
  quantidade = 25,
  agora,
  geradorDeId,
}: Parametros): Tarefa[] {
  // Validação explícita: não depende de como `Array.from` trata negativo/NaN.
  if (!Number.isInteger(quantidade) || quantidade <= 0) return [];
  return Array.from({ length: quantidade }, (_, i) => {
    const [base, descricao] = EXEMPLOS[i % EXEMPLOS.length];
    const rodada = Math.floor(i / EXEMPLOS.length);
    const titulo = rodada === 0 ? base : `${base} (${rodada + 1})`;
    return Tarefa.criar(
      { titulo, descricao },
      { id: geradorDeId.gerar(), agora: new Date(agora.getTime() - i * 60_000) },
    );
  });
}
