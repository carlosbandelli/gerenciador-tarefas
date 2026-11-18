import { Skeleton } from "@/components/ui/skeleton";

export function ListaCarregando() {
  return (
    <div
      role="status"
      aria-label="Carregando tarefas"
      aria-busy="true"
      className="flex flex-col gap-3"
    >
      <span className="sr-only">Carregando tarefas…</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
