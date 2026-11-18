// Tipo de VIEW: o que a apresentação precisa de uma tarefa. Estruturalmente compatível com o
// DTO do módulo (a `ui` não importa a aplicação nem o index do servidor), então o resultado de
// `useTarefas` é atribuível a ele sem conversão.
export type TarefaView = {
  id: string;
  titulo: string;
  descricao?: string;
  dataCriacao: Date;
  dataAtualizacao?: Date;
};
