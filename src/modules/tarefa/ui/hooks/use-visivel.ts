import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Opcoes = {
  rootMargin?: string;
  // Muda => o elemento é re-observado. O IntersectionObserver só notifica MUDANÇAS: se o sentinela
  // continuar visível depois de uma página carregar, sem re-observar nada dispararia de novo.
  reobservarQuando?: unknown;
};

// Hook de UI genérico: chama `aoEntrar` quando o elemento (ligado pelo `ref` devolvido) entra na
// viewport. O callback mais recente fica em ref: trocar a identidade dele NÃO recria o observer.
export function useVisivel<T extends Element>(
  aoEntrar: () => void,
  { rootMargin = "0px", reobservarQuando }: Opcoes = {},
) {
  const [elemento, setElemento] = useState<T | null>(null);
  const callbackRef = useRef(aoEntrar);

  // Layout effect: o callback novo vale antes de qualquer notificação do observer. (O
  // `useEffectEvent` do React não pode ser chamado dentro do callback de um observer externo.)
  useLayoutEffect(() => {
    callbackRef.current = aoEntrar;
  });

  useEffect(() => {
    if (!elemento || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) callbackRef.current();
      },
      { rootMargin },
    );
    observer.observe(elemento);
    return () => observer.disconnect();
  }, [elemento, rootMargin, reobservarQuando]);

  // `setState` já é estável: serve direto como ref callback.
  return setElemento;
}
