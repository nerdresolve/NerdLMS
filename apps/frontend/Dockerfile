# =============================================================================
# Build em múltiplos estágios: a imagem final não carrega compilador,
# dependências de desenvolvimento nem código-fonte.
#
# Versão fixada por dígito menor (§27). `latest` faz o build de amanhã diferir
# do de hoje sem ninguém mudar nada.
#
# CONTEXTO: a raiz do repositório, não `apps/frontend`. O `package-lock.json` de
# um workspace npm existe só na raiz — é ele que descreve a árvore inteira, e
# `npm ci` recusa trabalhar sem ele. Copiar apenas o app deixaria o lockfile de
# fora; duplicá-lo dentro do app criaria uma segunda fonte de verdade, que é
# exatamente o que o workspace existe para evitar.
#
# A organização não muda: nada novo na raiz, e todo arquivo do app continua em
# `apps/frontend`. Só o `--workspace` abaixo sabe onde ele está.
# =============================================================================

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/core/package.json ./packages/core/

# `npm ci` exige lockfile, e é assim de propósito: sem ele, dois builds da
# mesma imagem podem resolver versões diferentes. O lockfile precisa ser
# gerado uma vez, numa máquina com rede, e versionado:
#
#   npm install && git add package-lock.json
#
# A verificação abaixo existe para a falha ser essa frase, e não um erro
# críptico do npm no meio do build.
RUN test -f package-lock.json || { \
      echo ""; \
      echo "ERRO: package-lock.json ausente."; \
      echo "Gere uma vez com 'npm install' e versione o arquivo."; \
      echo "Ver docs/ENTREGA.md."; \
      echo ""; \
      exit 1; \
    } && \
    npm ci --omit=dev --workspace @nerdlms/frontend --workspace @nerdlms/backend --workspace @nerdlms/core --include-workspace-root && \
    cp -R node_modules /prod_modules && \
    npm ci --workspace @nerdlms/frontend --workspace @nerdlms/backend --workspace @nerdlms/core --include-workspace-root

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/frontend ./apps/frontend
# O app importa `@nerdlms/core` e `@nerdlms/backend`; sem eles no contexto, o build
# não resolve.
COPY apps/backend ./apps/backend
COPY packages/core ./packages/core
ENV NEXT_TELEMETRY_DISABLED=1
# `next build` roda dentro do app; o script da raiz já delega para o workspace.
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Sem isto, o servidor standalone escuta só no IP do hostname do container:
    # o proxy até alcança, mas o healthcheck (127.0.0.1) leva ECONNREFUSED e o
    # container fica "unhealthy" servindo páginas normalmente.
    HOSTNAME=0.0.0.0

# Banco de fusos horários.
#
# A imagem alpine não o traz, e sem ele a variável `TZ` é IGNORADA em silêncio:
# `date` e o Node continuam em UTC mesmo com `TZ=America/Sao_Paulo` definida no
# compose. Foi o que aconteceu — a variável estava lá, o relógio não mudou, e
# só olhando o relógio de dentro do contêiner é que se vê.
#
# Importa porque o calendário é montado com `new Date()`: três horas à frente,
# entre 21h e meia-noite no horário local o servidor já está no dia seguinte, e
# a agenda marcaria amanhã como hoje.
RUN apk add --no-cache tzdata

# ffmpeg: o corte automático de vídeo em aulas de quinze minutos.
#
# No RUNTIME e não só na construção — quem corta é o trabalhador que roda junto
# do servidor, quando um instrutor envia um vídeo longo. Sem ele o produto
# continua funcionando e os vídeos ficam inteiros, com um aviso no arranque.
RUN apk add --no-cache ffmpeg

# Usuário próprio, não o root e nem o `node` padrão da imagem.
RUN addgroup -g 10001 -S nerdlms && adduser -u 10001 -S nerdlms -G nerdlms

# O standalone de um workspace preserva a estrutura do repositório: ele traz
# `apps/frontend/server.js` junto de um `node_modules` já podado. Copiar a raiz
# do standalone mantém esses caminhos coerentes entre si.
COPY --from=build --chown=nerdlms:nerdlms /app/apps/frontend/.next/standalone ./
COPY --from=build --chown=nerdlms:nerdlms /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build --chown=nerdlms:nerdlms /app/apps/frontend/public ./apps/frontend/public

USER nerdlms
EXPOSE 3000

# `dumb-init` não é necessário: o Node como PID 1 do standalone já trata sinais.
CMD ["node", "apps/frontend/server.js"]
