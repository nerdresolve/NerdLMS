<div align="center">

<img src="docs/brand/nerdresolve-mark.png" alt="" width="120">

# NerdResolve LMS

**Plataforma de ensino corporativo white-label, pronta para produção.**

Multi-tenant, com SCORM, xAPI, LTI 1.3, SSO corporativo e certificado
verificável. Você hospeda, você é dono do dado, a marca na tela é a sua.

[![CI](https://github.com/mariathdev/nerdlms/actions/workflows/ci.yml/badge.svg)](https://github.com/mariathdev/nerdlms/actions/workflows/ci.yml)
[![Segurança](https://github.com/mariathdev/nerdlms/actions/workflows/seguranca.yml/badge.svg)](https://github.com/mariathdev/nerdlms/actions/workflows/seguranca.yml)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-PolyForm%20Noncommercial-7C3AED)](LICENSE.md)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-7C3AED)](.nvmrc)

</div>

---

## Por que existe

Plataforma de treinamento corporativo costuma ser alugada por usuário ativo. O
limite é contratual, não técnico — e o histórico de quem cursou o quê, com que
nota e em que data fica na base de outra empresa.

Este projeto é o outro caminho: você hospeda, você é dono do dado, e a marca na
tela é a sua. Uma instalação atende vários clientes ao mesmo tempo, cada um com
domínio, cores e logo próprios, sem um enxergar o outro.

## O que já funciona

| | |
|---|---|
| **Aluno** | Assiste, faz prova, recebe certificado. A conclusão exige 90% de cobertura do vídeo **com tempo de sessão compatível** — não basta arrastar a barra. Avanço para trecho não assistido é bloqueado por curso (configurável); retroceder é livre, e a velocidade vai a 2x. |
| **Prova** | Nota 0–10, aprovação configurável. Só libera quando as aulas terminam, e o botão diz quantas faltam em vez de deixar clicar e recusar depois. Reprovou? O reteste é **pedido ao instrutor**, que libera ou recusa com comentário obrigatório. |
| **Certificado** | PDF com assinatura do instrutor e código conferível em `/validar`. A verificação reavalia matrícula, conclusão e nota — não confia no código sozinho. |
| **Instrutor** | Cria curso, módulo e aula; envia vídeo, PDF, SCORM ou H5P; monta prova com banco de questões; corrige dissertativa por rubrica; decide retestes; registra **eficácia do treinamento** meses depois. |
| **Gestor** | Acompanha a equipe: quem começou, quem parou, quem vence prazo. |
| **Administrador** | Pessoas, acesso, auditoria, competências, plano de formação por cargo, trilhas por função e local, distintivos, biblioteca, integrações e marca. |
| **Entrar pela empresa** | LDAP/Active Directory, SAML 2.0, Google e Microsoft. O papel na plataforma vem do grupo no diretório. |
| **Interoperar** | SCORM 1.2 e 2004, cmi5, xAPI com LRS próprio, LTI 1.3 com AGS e NRPS, Open Badges. |

**38 telas · 65 rotas de API · 83 tabelas · 46 migrações · 1.444 testes automatizados**

## Começar

```bash
git clone https://github.com/mariathdev/nerdlms.git && cd nerdlms
npm ci

cp infra/.env.example infra/.env      # gere os segredos: openssl rand -base64 48
npm run up                             # banco, storage e proxy
npm run migrate                        # schema
npm run seed                           # contas e catálogo de demonstração
npm run dev
```

Abre em <http://localhost:3000>. As contas de demonstração estão em
[docs/HOMOLOGACAO.md](docs/HOMOLOGACAO.md).

Precisa de Node 22+ e Docker. **Sem Docker você ainda vai longe:** os testes, os
portões de acessibilidade e o protótipo navegável em `apps/frontend/preview/`
rodam sem nada além do npm.

## Deixar com a sua marca

Um arquivo, quatro imagens:

```ts
// packages/core/src/brand/brand.config.ts
export const NOME = "Academia ACME";
export const COR  = "#0F766E";
```

Troque os PNGs em `apps/frontend/public/brand/`, rode `npm run preview` e
pronto. A rampa de cor da interface fica em
`apps/frontend/src/styles/nerd-ds/tokens/colors.css`.

`npm run test:a11y` **reprova** se a cor nova não passar em contraste WCAG AA.
É de propósito: acessibilidade é régua do produto, não escolha por cliente.

O passo a passo completo — tenant, domínio, e-mail, marca por cliente — está em
[WHITELABEL.md](WHITELABEL.md).

## Publicar

```bash
git tag v1.0.0 && git push origin v1.0.0
```

A [Action de deploy](.github/workflows/deploy.yml) roda os portões, publica a
imagem no GHCR e — se você configurar os secrets de SSH — atualiza o servidor:
migra o banco, troca o container e **espera o healthcheck** antes de declarar
sucesso. Sem os secrets, ela publica a imagem e pula o resto, sem erro.

Detalhes em [docs/DEPLOY.md](docs/DEPLOY.md).

## Como está organizado

```
apps/frontend/    Next.js 15 + React 19 — telas e rotas HTTP
apps/backend/     casos de uso, repositórios e integrações
packages/core/    regra de domínio pura: sem React, sem SQL, sem framework
infra/            docker-compose, migrações, proxy e ferramentas
docs/             implantação, homologação, design system e perfis
```

As camadas têm direção — `frontend → backend → core` — e um portão automático
(`npm run check:layers`) reprova import na direção errada. É o que mantém a
regra de negócio testável sem subir banco: os 1.357 testes do `core` rodam em
5 segundos, sem Docker.

## Qualidade

```bash
npm run verify      # o que a CI roda
```

Testes de unidade, contraste WCAG AA token a token, critérios da WCAG 2.2,
geração do protótipo, orçamento de peso por página, imports declarados,
hidratação, estrutura do SQL, codificação dos arquivos e direção das camadas.

Em cada PR e toda semana: CodeQL, `npm audit` e Gitleaks.

## Segurança

Contêineres sem root e com sistema de arquivos somente-leitura. Banco sem porta
publicada. Papel de aplicação no Postgres sem permissão de DDL. Auditoria em
tabela somente-inserção, com gatilho que recusa UPDATE e DELETE. Segredos
cifrados em repouso. Isolamento entre clientes coberto por teste.

Encontrou uma falha? [SECURITY.md](SECURITY.md) — nunca em issue pública.

## Contribuir

[CONTRIBUTING.md](CONTRIBUTING.md). Defeito e proposta em
[issues](https://github.com/mariathdev/nerdlms/issues); dúvida em
[discussions](https://github.com/mariathdev/nerdlms/discussions).

## Licença

**PolyForm Noncommercial 1.0.0** — ver [LICENSE.md](LICENSE.md).

Livre para estudar, modificar, redistribuir e usar sem fins lucrativos:
pesquisa, avaliação, projeto pessoal, instituição de ensino, órgão público,
organização sem fins lucrativos.

Uso comercial — operar para clientes, revender, oferecer como serviço, ou usar
internamente numa empresa com fins lucrativos — requer licença comercial:
**contato@mariath.dev**.

A fonte **Satoshi**, que acompanha o repositório, permite uso mas **não
redistribuição** — se você publicar um fork, troque-a. Alternativas sob OFL
estão em [apps/frontend/public/fonts/LEIA-ME.md](apps/frontend/public/fonts/LEIA-ME.md).

---

<div align="center">
<sub>Feito por <a href="https://github.com/mariathdev">Matheus Mariath</a> · NerdResolve</sub>
</div>
