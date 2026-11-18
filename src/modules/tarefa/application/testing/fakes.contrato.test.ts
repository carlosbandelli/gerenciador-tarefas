import { descreverContratoDoTarefaRepository } from "../../domain/testing/tarefa-repository.contract";
import { RepositorioFake } from "./fakes";

// O fake dos testes do service precisa ser um repositório honesto: passa no mesmo contrato das
// implementações reais, senão os testes do service poderiam validar um comportamento inexistente.
descreverContratoDoTarefaRepository("RepositorioFake", () => new RepositorioFake());
