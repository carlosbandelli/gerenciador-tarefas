"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DESCRICAO_MAX, TITULO_MAX, tamanho } from "../../domain/regras";
import { atualizarTarefaSchema, criarTarefaSchema } from "../../interface/schema";
import type { ErrosPorCampo, ValoresDaTarefa } from "../hooks/use-salvar-tarefa";

// O que o usuário digita (entrada do schema); `onSalvar` recebe a SAÍDA já validada e trimada.
type CamposDoForm = { titulo: string; descricao?: string | null };

type Props = {
  modo: "criar" | "editar";
  valoresIniciais?: CamposDoForm;
  onSalvar: (valores: ValoresDaTarefa) => void;
  salvando: boolean;
  // Erros que vieram do servidor, por campo (do `useSalvarTarefa`).
  errosDoServidor?: ErrosPorCampo;
};

// Schema por modo: a MESMA fonte de verdade da borda do servidor (mensagens idênticas no
// navegador e na API). Criar usa `criarTarefaSchema` (descrição vazia vira `undefined`). Editar usa
// `atualizarTarefaSchema` sem o `id` (que não é campo do form; o container o injeta): descrição
// vazia vira `null`, o que significa APAGAR, e não "não alterar".
// `.required({ titulo: true })`: no schema do servidor o título é opcional (não alterar), mas o
// form sempre o envia; assim `undefined` também vira "O título é obrigatório" e o tipo de saída
// tem `titulo: string`, igual a `ValoresDaTarefa`.
const SCHEMA_EDITAR = atualizarTarefaSchema.omit({ id: true }).required({ titulo: true });
const SEM_ERROS: ErrosPorCampo = {};
const CAMPOS = ["titulo", "descricao"] as const;

// `aria-describedby` do campo: o erro (se houver) vem antes do contador, para o leitor de tela
// anunciá-lo primeiro.
function descreve(contadorId: string, erroId: string | null) {
  return erroId ? `${erroId} ${contadorId}` : contadorId;
}

// APRESENTAÇÃO + estado do formulário (react-hook-form). Não sabe de rede nem de rotas: o
// container entrega `onSalvar`, `salvando` e os erros do servidor.
//
// Sem `memo`: `salvando` e os erros mudam a cada transição da mutação, então o form re-renderiza
// de qualquer jeito (ganho marginal); o que o usuário digita fica no estado do RHF, não em props.
export function TarefaForm({
  modo,
  valoresIniciais,
  onSalvar,
  salvando,
  errosDoServidor = SEM_ERROS,
}: Props) {
  // Calculado uma vez: alimenta o `defaultValues` do RHF e o `defaultValue` do DOM (SSR).
  const iniciais = {
    titulo: valoresIniciais?.titulo ?? "",
    descricao: valoresIniciais?.descricao ?? "",
  };
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<CamposDoForm, unknown, ValoresDaTarefa>({
    // Cast explícito: o resolver é tipado pelo Input/Output do schema escolhido (dois schemas, com
    // `descricao` transformada em undefined/null), e aqui só o contrato do form
    // (`CamposDoForm` -> `ValoresDaTarefa`) importa. Os testes cobrem a saída real.
    resolver: zodResolver(
      modo === "criar" ? criarTarefaSchema : SCHEMA_EDITAR,
    ) as unknown as Resolver<CamposDoForm, unknown, ValoresDaTarefa>,
    defaultValues: iniciais,
    // Foco no primeiro campo inválido ao submeter (padrão do RHF, explícito por ser requisito).
    shouldFocusError: true,
  });

  // Erros do servidor entram como erros do campo (mesmo visual e a11y dos do front); o primeiro
  // leva o foco (`shouldFocus`). Reaplica a cada objeto novo de erros, mesmo com texto igual.
  useEffect(() => {
    CAMPOS.filter((campo) => errosDoServidor[campo]?.length).forEach((campo, i) =>
      setError(
        campo,
        { type: "server", message: errosDoServidor[campo][0] },
        { shouldFocus: i === 0 },
      ),
    );
  }, [errosDoServidor, setError]);

  // Trava SÍNCRONA contra duplo envio: `salvando` só chega por props no render seguinte, e dois
  // submits no mesmo tick (ex.: duplo Enter) passariam. Marcada ao aceitar o envio e liberada no
  // próximo macrotask: até lá o `salvando` real já chegou (o guard do `onSubmit` assume). Não
  // dependemos de `salvando` voltar a false: uma falha instantânea pode nunca renderizar o
  // estado "pendente" e a trava ficaria presa, impedindo o reenvio.
  const enviando = useRef(false);

  // `useWatch` (e não `watch()`): assinatura explícita aos campos, sem o aviso de biblioteca
  // incompatível do lint de hooks; alimenta os contadores de caracteres.
  const valores = useWatch({ control });
  const id = useId();
  const tituloErroId = `${id}-titulo-erro`;
  const descricaoErroId = `${id}-descricao-erro`;
  const tituloContadorId = `${id}-titulo-contador`;
  const descricaoContadorId = `${id}-descricao-contador`;

  return (
    <form
      noValidate
      // `aria-disabled` no botão não impede o submit por Enter: ignoramos aqui enquanto salva.
      onSubmit={(evento) => {
        if (salvando) {
          evento.preventDefault();
          return;
        }
        void handleSubmit((dados) => {
          if (enviando.current) return;
          enviando.current = true;
          setTimeout(() => (enviando.current = false), 0);
          onSalvar(dados);
        })(evento);
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor={`${id}-titulo`}>Título</Label>
          {/* Fora do <label> para não entrar no nome acessível; `aria-required` já informa. */}
          <span aria-hidden="true" className="text-destructive text-sm">
            *
          </span>
        </div>
        <Input
          id={`${id}-titulo`}
          // Sem `maxLength` HTML: ele conta UTF-16 (um emoji vale 2) e corta colagens sem aviso,
          // divergindo do domínio, que conta code points. O contador e o Zod avisam o excesso.
          readOnly={salvando}
          // `defaultValue` além do `defaultValues` do RHF: o RHF só preenche o DOM na montagem
          // (cliente), então o HTML do SSR sairia com o input vazio. Mesmo valor, sem conflito.
          defaultValue={iniciais.titulo}
          aria-required="true"
          aria-invalid={errors.titulo ? true : undefined}
          aria-errormessage={errors.titulo ? tituloErroId : undefined}
          aria-describedby={descreve(tituloContadorId, errors.titulo ? tituloErroId : null)}
          {...register("titulo")}
        />
        {errors.titulo ? (
          <p id={tituloErroId} role="alert" className="text-destructive text-sm">
            {errors.titulo.message}
          </p>
        ) : null}
        <p id={tituloContadorId} className="text-muted-foreground text-xs">
          {tamanho(valores.titulo ?? "")}/{TITULO_MAX}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-descricao`}>Descrição</Label>
        <Textarea
          id={`${id}-descricao`}
          readOnly={salvando}
          defaultValue={iniciais.descricao}
          aria-invalid={errors.descricao ? true : undefined}
          aria-errormessage={errors.descricao ? descricaoErroId : undefined}
          aria-describedby={descreve(
            descricaoContadorId,
            errors.descricao ? descricaoErroId : null,
          )}
          {...register("descricao")}
        />
        {errors.descricao ? (
          <p id={descricaoErroId} role="alert" className="text-destructive text-sm">
            {errors.descricao.message}
          </p>
        ) : null}
        <p id={descricaoContadorId} className="text-muted-foreground text-xs">
          {tamanho(valores.descricao ?? "")}/{DESCRICAO_MAX}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Link href="/tarefas" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
        <Button type="submit" aria-disabled={salvando} className="aria-disabled:opacity-50">
          {salvando ? "Salvando..." : modo === "criar" ? "Salvar" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
