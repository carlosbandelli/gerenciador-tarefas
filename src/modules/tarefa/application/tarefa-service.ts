import { TarefaNaoEncontradaError } from "../domain/erros";
import type { GeradorDeId } from "../domain/gerador-de-id";
import type { Relogio } from "../domain/relogio";
import { Tarefa } from "../domain/tarefa";
import { TarefaId } from "../domain/tarefa-id";
import type { TarefaRepository } from "../domain/tarefa-repository";
import type {
  AtualizarTarefaComando,
  CriarTarefaComando,
  ListarTarefasComando,
  TarefaCasosDeUso,
} from "./tarefa-casos-de-uso";
import { TarefaMapper, type PaginaDeTarefasDTO, type TarefaDTO } from "./tarefa-dto";

// Orquestra os casos de uso. As regras vivem no domínio; aqui só: resolver id/data pelas portas,
// carregar, delegar e persistir. Erros de domínio sobem SEM tradução (a interface os mapeia).
// Dependências por construtor, sempre como portas (DIP): o container decide as implementações.
export class TarefaService implements TarefaCasosDeUso {
  constructor(
    private readonly repositorio: TarefaRepository,
    private readonly relogio: Relogio,
    private readonly geradorDeId: GeradorDeId,
  ) {}

  async criar(comando: CriarTarefaComando): Promise<TarefaDTO> {
    const tarefa = Tarefa.criar(comando, {
      id: this.geradorDeId.gerar(),
      agora: this.relogio.agora(),
    });
    await this.repositorio.salvar(tarefa);
    return TarefaMapper.paraDTO(tarefa);
  }

  async listar({ cursor, limit }: ListarTarefasComando): Promise<PaginaDeTarefasDTO> {
    const pagina = await this.repositorio.listar({ cursor, limit });
    return { itens: pagina.itens.map(TarefaMapper.paraDTO), proximoCursor: pagina.proximoCursor };
  }

  async buscarPorId(id: string): Promise<TarefaDTO> {
    return TarefaMapper.paraDTO(await this.obter(TarefaId.criar(id)));
  }

  async atualizar(id: string, alteracoes: AtualizarTarefaComando): Promise<TarefaDTO> {
    const tarefa = await this.obter(TarefaId.criar(id));
    // Se o domínio rejeitar (título inválido etc.) lança antes do `salvar`: nada é persistido.
    // Só persiste se algo mudou: evita escrita inútil (relevante quando houver banco).
    if (tarefa.atualizar(alteracoes, this.relogio.agora())) await this.repositorio.salvar(tarefa);
    return TarefaMapper.paraDTO(tarefa);
  }

  // Devolve o id CANÔNICO (minúsculas, normalizado por `TarefaId`), não o texto recebido.
  async deletar(id: string): Promise<{ id: string }> {
    const tarefaId = TarefaId.criar(id);
    if (!(await this.repositorio.remover(tarefaId))) throw new TarefaNaoEncontradaError(tarefaId);
    return { id: tarefaId.valor };
  }

  private async obter(id: TarefaId): Promise<Tarefa> {
    const tarefa = await this.repositorio.buscarPorId(id);
    if (tarefa === null) throw new TarefaNaoEncontradaError(id);
    return tarefa;
  }
}
