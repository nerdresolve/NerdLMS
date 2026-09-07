#!/usr/bin/env bash
# =============================================================================
# O que roda NO SERVIDOR durante o deploy.
#
# Fica num arquivo, e não embutido no YAML, por três motivos: dá para ler sem
# desembaraçar escapes de heredoc dentro de heredoc, dá para rodar à mão no
# servidor quando o deploy automático não é uma opção, e o shellcheck enxerga.
#
# Recebe `CAMINHO` do workflow (ver .github/workflows/deploy.yml).
#
# À mão, no servidor:
#   CAMINHO=/opt/nerdlms bash deploy-remoto.sh
# =============================================================================
set -euo pipefail

CAMINHO="${CAMINHO:-/opt/nerdlms}"
COMPOSE=(docker compose -f infra/docker-compose.yml --env-file infra/.env)
ESPERA_MAX=30   # tentativas
INTERVALO=5     # segundos entre elas

cd "$CAMINHO"

echo "→ Migrações"
# ANTES de trocar a aplicação, de propósito. O schema novo precisa aceitar a
# versão antiga por um instante — é o que permite voltar atrás trocando a tag
# da imagem, sem restaurar backup. Migração que quebra a versão anterior tem
# de ser dividida em duas entregas.
"${COMPOSE[@]}" --profile tools run --rm migrate

echo "→ Baixando a imagem nova"
"${COMPOSE[@]}" pull app

echo "→ Trocando o container"
# `--no-deps`: só a aplicação reinicia. Sem isso o Compose reinicia banco e
# storage junto, e uma troca de versão da aplicação vira indisponibilidade de
# tudo — inclusive do que não mudou.
"${COMPOSE[@]}" up -d --no-deps app

echo "→ Esperando ficar saudável"
# Espera o healthcheck em vez de declarar sucesso assim que o container sobe.
# Container "running" com a aplicação quebrada por dentro é o caso comum: sem
# esta espera o deploy termina verde e o site está fora.
container="$("${COMPOSE[@]}" ps -q app)"
if [ -z "$container" ]; then
  echo "ERRO: o serviço app não subiu." >&2
  exit 1
fi

for _ in $(seq 1 "$ESPERA_MAX"); do
  estado="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo partindo)"
  case "$estado" in
    healthy)
      echo "✓ No ar."
      exit 0
      ;;
    unhealthy)
      echo "ERRO: subiu quebrado. Últimas linhas:" >&2
      "${COMPOSE[@]}" logs --tail 50 app >&2
      exit 1
      ;;
  esac
  sleep "$INTERVALO"
done

echo "ERRO: não ficou saudável em $((ESPERA_MAX * INTERVALO))s. Últimas linhas:" >&2
"${COMPOSE[@]}" logs --tail 50 app >&2
exit 1
