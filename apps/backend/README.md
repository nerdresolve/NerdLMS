# `@nerdlms/backend`: camada de servidor

Tudo que fala com o PostgreSQL, com o storage e com sistemas de fora. **Não
conhece React nem Next**: recebe dados, devolve dados.

## Como está organizado

Cada pasta segue a mesma divisão, herdada do que o SCE API faz entre `Service`
e `Models/DTOs`: o **caso de uso** concentra a regra e a auditoria, o
**repositório** concentra o SQL, e o contrato, ou seja, o que entra e o que sai, mora
em `@nerdlms/core`, sem saber que existe banco.

```
src/db/pool.ts          conexão e query parametrizada
src/auth/               login, sessão, senha, recuperação
src/courses/            curso, módulo, aula, matrícula, progresso, agenda,
                        trilha, fórum, material, turma
src/assessment/         prova, tentativa, correção, nota, reteste
src/ldap/               bind e busca contra Active Directory e OpenLDAP
src/saml/ src/sso/      SAML 2.0, Google, Microsoft, OIDC genérico
src/scorm/ src/xapi/    pacotes SCORM, statements xAPI, cmi5
src/lti/                LTI 1.3 e envio de nota (AGS)
src/reports/            certificado em PDF, exportação CSV
src/crypto/secret-box.ts  cofre AES-256-GCM para segredos que precisam VOLTAR
src/tenancy/            recorte por cliente, e o teste que o vigia
src/storage/            URL assinada para o arquivo não atravessar a aplicação
```

## Duas coisas que valem explicação

**`crypto/secret-box.ts`** existe porque nem todo segredo pode virar hash. A
senha de uma pessoa vira: ninguém precisa saber qual era, só conferir se bate.
A senha da conta de serviço do Active Directory, não: a aplicação precisa
apresentá-la ao diretório. A chave é derivada do `SESSION_SECRET` por HKDF, com
rótulo por uso, e mora no ambiente do processo. Isso protege contra o segredo
sair junto com um dump do banco, que é o caminho que de fato acontece. Não
protege contra quem já executa código no servidor, e o arquivo diz isso.

**`tenancy/query-isolation.test.ts`** falha o build quando alguém escreve uma
consulta sem o recorte por `tenant_id`. É a única garantia que sobrevive a
quem não leu a documentação.

## Por que as rotas HTTP não estão aqui

Os `route.ts` continuam em `apps/frontend/src/app/api/`, e não por comodismo:
no Next a rota **é** o arquivo. Movê-los para cá faria o endpoint deixar de
existir.

Eles são cascas finas: leem o corpo, chamam o caso de uso, montam a resposta:

```ts
// apps/frontend/src/app/api/auth/login/route.ts
const outcome = await loginUseCase({ identifier, password, remember, ip, userAgent });
```

Toda a regra está deste lado. Se um dia a API sair do Next para um processo
próprio, é o `route.ts` que se joga fora, não este pacote.

## Por que não há Fastify nem Express

Quem serve HTTP hoje é o Next. Acrescentar um servidor próprio significaria
segunda imagem, segundo deploy, CORS e uma porta a mais exposta, um custo real
por um ganho que ainda não existe. Este pacote é a camada **abaixo** do HTTP, e
continua válido se essa decisão mudar.

## Regras de domínio

Não são reescritas aqui. Este pacote as chama:

```
packages/core/src/courses/      progresso, catálogo, conclusão, trava do player
packages/core/src/assessment/   nota de 0 a 10, aprovação, reteste
packages/core/src/auth/         permissões, senha, contrato do login
packages/core/src/ldap/         BER, filtros e leitura das respostas do diretório
```

## Rodar

```bash
npm run typecheck --workspace @nerdlms/backend
npm run test --workspace @nerdlms/backend      # 49 testes, sem banco e sem rede
```

Os testes daqui não sobem PostgreSQL: eles conferem a **forma** das consultas e
das decisões. O que depende de banco é conferido pela tela, contra o ambiente
local, conforme `docs/HOMOLOGACAO.md`.
