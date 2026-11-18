import type { Metadata } from "next";
import { NovaTarefa } from "@/modules/tarefa/ui";

export const metadata: Metadata = { title: "Nova tarefa" };

export default function PaginaNovaTarefa() {
  return (
    <main className="mx-auto w-full max-w-2xl p-4">
      <h1 className="mb-6 text-2xl font-semibold">Nova tarefa</h1>
      <NovaTarefa />
    </main>
  );
}
