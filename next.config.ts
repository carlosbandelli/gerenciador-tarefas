import type { NextConfig } from "next";

// Headers de segurança básicos em todas as rotas. Sem CSP de scripts: o Next injeta scripts
// inline na hidratação e uma CSP estrita exigiria nonce por request (fora do escopo do desafio).
const HEADERS_DE_SEGURANCA = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Não anuncia o framework no header `X-Powered-By`.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: HEADERS_DE_SEGURANCA }];
  },
  // React Compiler fica DESLIGADO (não definir `reactCompiler`): a memoização manual
  // (useMemo/useCallback/React.memo) é decisão do projeto e precisa ser demonstrável (há teste).
  //
  // `cacheComponents` e `partialPrefetching` vêm ligados no template do create-next-app, mas foram
  // removidos de propósito: mudam a semântica de cache/renderização e não são necessários aqui.
  // Os dados são em memória e dinâmicos; manter o modelo padrão evita surpresas com tRPC/SSR.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
