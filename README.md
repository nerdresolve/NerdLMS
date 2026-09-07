# Exemplo S.A. EAD

Plataforma de ensino corporativo da Exemplo S.A., mantida internamente:
código, banco de dados e roadmap sob gestão da empresa.

Substitui a licença atual, limitada a 500 usuários ativos para toda a empresa.
O limite é contratual, e não técnico. O histórico de treinamento (quem cursou,
em quê, com que nota e em que data) passa a ser mantido na base da NerdResolve
Energy.

A identidade vem do nosso site: azul #002E6D e #0075C9 do logotipo, DM Sans,
canto reto. Os tokens estão em `apps/frontend/src/styles/nerd-ds/` e os
arquivos de marca são gerados de lá por `apps/frontend/tools/brand-assets.py`.

---

## O que a plataforma faz hoje

**Aluno** acessa o curso, assiste às aulas, realiza a prova e recebe o
certificado. O controle de progresso exige 90% de cobertura do vídeo com tempo
de sessão compatível antes de aceitar a conclusão. O avanço para trecho não
assistido é bloqueado; o retrocesso é liberado e a velocidade pode chegar a 2x.

**Prova** vale de 0 a 10, com aprovação em 8,0. Ela só libera quando as aulas
do curso terminam, e o botão diz quantas faltam em vez de deixar clicar e
recusar depois. Quem reprova tem uma tentativa; refazer depende de **pedir
reteste ao instrutor**, que libera ou recusa com comentário obrigatório.

**Certificado** é emitido em PDF, com assinatura do instrutor responsável e
código de verificação conferido em `/validar`. A verificação avalia matrícula,
conclusão e nota, aplicando a mesma regra usada na emissão.

**Instrutor** cria curso, módulo e aula, envia vídeo, PDF ou pacote SCORM,
monta prova, corrige dissertativa e decide os pedidos de reteste.

**Gestor** acompanha a equipe. **Administrador** cuida de pessoas, acesso,
auditoria, competências, distintivos, integrações e marca.

**Entrar pela conta da empresa** funciona por LDAP/Active Directory, SAML 2.0,
Google ou Microsoft. O papel na plataforma vem do grupo no diretório.

São 35 telas, 38 migrações e 1.214 testes automatizados.

---

## Estrutura

```
apps/
  frontend/   Next.js 15 + React 19. Telas e rotas HTTP.
  backend/    Casos de uso, repositórios e integrações. Não é um servidor:
              é o código que as rotas do Next chamam.

packages/
  core/       Regras de domínio. Sem framework e sem dependência de runtime.

infra/
  docker-compose.yml, .env.example
  db/migrations/   schema PostgreSQL, aplicado em ordem
  proxy/Caddyfile  HTTPS e headers de borda
  tools/           conteúdo real, seed e verificação estrutural do SQL

docs/
  PLATAFORMA.md            a documentação completa: o que existe e por quê
  PERFIS-E-ACESSOS.md      os cinco perfis, o que cada um alcança, e as contas
  ROTEIRO-APRESENTACAO.md  o roteiro de demonstração, com tempos
  progress.md              diário de engenharia: cada decisão técnica
  DEPLOY.md                subir a plataforma
  HOMOLOGACAO.md           contas, acesso e o que conferir antes de liberar
  ENTREGA.md               como navegar o pacote
  PRD.md                   escopo de origem, escrito para outra empresa
  PLANO-LMS.md             os 50 itens do plano, também de origem
  telas/                   capturas em desktop e mobile

WHITELABEL.md   configurar uma instalação do zero: tenant, marca, domínio
```

---

## Rodar

Os portões não precisam de rede:

```bash
npm run test          # regras de negócio, backend e frontend
npm run typecheck
npm run lint
npm run check:sql     # verificação estrutural das migrações
npm run check:imports # todo pacote importado está declarado?
npm run test:a11y     # contraste WCAG AA, por token
npm run verify        # os acima menos o typecheck, mais as auditorias do protótipo
```

`verify` **não** executa `typecheck`. Os dois comandos devem ser executados
antes do commit.

Subir o ambiente, **nesta ordem**:

```bash
npm install
cp infra/.env.example infra/.env    # e preencha os segredos
npm run up
npm run migrate
```

A plataforma responde em <http://localhost:8080>.

> **`npm run seed` traz conteúdo fictício junto.** Além das cinco contas de
> demonstração, ele insere 7 cursos inventados com 84 aulas e 20 matrículas, e
> todos os `INSERT` são `ON CONFLICT DO UPDATE`: rodar num banco que já tem o
> conteúdo real da Exemplo S.A. faz o catálogo voltar a misturar os dois.
> Num banco vazio ele é o caminho mais rápido para ter com quem entrar; num
> banco em uso, leia `docs/HOMOLOGACAO.md` antes.

### Os três ambientes não se misturam

Cada script carrega o próprio nome de projeto do Compose, e é ele que separa os
volumes. Nunca rode `docker compose` sem `-p`:

| Comando | Projeto | Para quê |
|---|---|---|
| `npm run up`, `migrate`, `seed`, `logs` | `nerdlms-local` | desenvolvimento |
| `npm run up:prod`, `migrate:prod` | `nerdlms` | produção |
| `npm run publish`, `migrate:tunnel` | `nerdlms` | produção pelo túnel |

### Nomes herdados que você vai encontrar

O papel do banco chama `lms_migrator`, a aplicação conecta como `lms_app` e
o bucket é `lms-media`. Não é engano nem sobra: o código foi escrito para
outra empresa antes de virar a nossa plataforma, e esses três nomes ficaram
sendo os de infraestrutura em uso.

A renomeação exigiria migração de banco e de storage, com risco de
indisponibilidade durante a troca, sem efeito para quem usa a plataforma. A
migração 035 registra a transição da instalação para a Exemplo S.A..

Pela mesma razão, `docs/PRD.md` e `docs/PLANO-LMS.md` falam de outra empresa:
são os documentos de origem, e servem para entender de onde veio cada
requisito.

---

## Conteúdo real

Os cursos da Exemplo S.A. não moram no repositório: o vídeo pesa 522 MB e o Git
não é lugar para isso. O que entra é o JSON com a estrutura, as provas e o
gabarito. A importação é dividida em três ferramentas, porque a transferência
de vídeo é demorada e sujeita a falha de rede, ao contrário da escrita no
banco:

```bash
node infra/tools/parse-cursos.mjs <pasta>   # lê o material e gera o JSON
node infra/tools/upload-cursos.mjs <pasta>  # manda os vídeos ao storage
node infra/tools/import-cursos.mjs          # cria cursos, aulas e provas
```

A importação é **idempotente**: cada id deriva do código do procedimento, então
rodar de novo depois de corrigir um gabarito atualiza sem duplicar nada.

Título e resumo de cada curso são curados na tabela dentro de
`parse-cursos.mjs`, e não no JSON: o JSON é saída e seria sobrescrito na
execução seguinte.

### Demonstrar sem esperar o vídeo

```bash
node infra/tools/cenario-demo.mjs
```

Os vídeos têm entre 56 e 85 minutos, e o controle de progresso é aplicado
integralmente, o que inviabiliza concluir um curso durante uma demonstração. O
script grava o progresso equivalente ao de quem assistiu ao conteúdo, nas
mesmas tabelas usadas em operação normal, e deixa a conta de Aluno com um curso
em cada estado previsto: prova bloqueada, prova liberada, reprovado com pedido
em aberto e aprovado com certificado.

---

## Leia antes de mexer

[`docs/PLATAFORMA.md`](./docs/PLATAFORMA.md) é a documentação completa: cada
área da plataforma, como funciona e por que foi feita assim.

[`docs/PERFIS-E-ACESSOS.md`](./docs/PERFIS-E-ACESSOS.md) tem os cinco perfis,
o que cada um alcança, as contas de demonstração e o que acontece quando
alguém tenta o que não pode. Há uma versão em PDF, na nossa identidade, para
levar a reunião.

[`docs/ROTEIRO-APRESENTACAO.md`](./docs/ROTEIRO-APRESENTACAO.md) é o roteiro de
demonstração, com tempos e o que dizer em cada tela.

[`docs/progress.md`](./docs/progress.md) é o diário de engenharia: cada decisão
técnica numerada, com o motivo e o que foi descartado. É o documento que
responde "por que está assim" quando o código sozinho não explica.

[`docs/HOMOLOGACAO.md`](./docs/HOMOLOGACAO.md) tem as contas de demonstração e
como a autenticação funciona.

[`WHITELABEL.md`](./WHITELABEL.md) descreve a configuração de uma instalação
do zero: tenant, marca, domínio, e-mail e autenticação pelo Active Directory.
Aplica-se à reconfiguração da instalação atual e ao cenário de treinamento a
terceirizados ou parceiros, com catálogo separado do interno.

[`docs/PRD.md`](./docs/PRD.md) e [`docs/PLANO-LMS.md`](./docs/PLANO-LMS.md) são
os documentos de origem, escritos para outra empresa. Servem para entender de
onde vem cada requisito; não descrevem a nossa instalação.
