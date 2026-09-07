/**
 * Configuração do ESLint — flat config.
 *
 * `npm run lint` existia no `package.json` desde sempre e falhava com "ESLint
 * couldn't find an eslint.config.(js|mjs|cjs)": o arquivo nunca foi criado.
 * Um portão que não roda é pior que portão nenhum, porque dá a impressão de
 * cobertura que não existe.
 *
 * `FlatCompat` porque o `eslint-config-next` 15.4 ainda é publicado no formato
 * antigo (`.eslintrc`), e o ESLint 9 só lê o formato novo. A ponte é o caminho
 * que a própria documentação do Next indica; some quando eles publicarem a
 * versão flat.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    /* O que NÃO é código-fonte deste app.

       `preview/` é saída do `build-preview.mjs` — HTML e um `prototype.js` em
       ES5 escrito para rodar direto no navegador, sem build. Passar o linter
       do Next nele acusaria `var` e `function` em cada linha, para um arquivo
       que é assim de propósito (DEC-031). */
    ignores: [
      ".next/**",
      "node_modules/**",
      "preview/**",
      "shots/**",
      "next-env.d.ts",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      /* O projeto usa `void promessa` para disparar trabalho de fundo sem
         esperar — carregar avisos, revalidar a rota. É a forma EXPLÍCITA de
         dizer "não espero por isto", e a regra padrão a trataria como erro. */
      "@typescript-eslint/no-floating-promises": "off",

      /* Argumento prefixado com `_` é a convenção do projeto para "a
         assinatura exige, o corpo não usa" — em `middleware(_request)`, por
         exemplo. Renomear para satisfazer a regra apagaria essa informação. */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
