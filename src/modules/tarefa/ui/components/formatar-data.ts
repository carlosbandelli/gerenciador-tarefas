// Fuso fixo: o mesmo texto no SSR (fuso do servidor) e no navegador, sem erro de hidratação.
const formato = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "dd/MM/yyyy HH:mm" montado pelas partes (o separador do `format()` varia entre versões do ICU).
export function formatarDataHora(data: Date): string {
  const p = Object.fromEntries(formato.formatToParts(data).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
