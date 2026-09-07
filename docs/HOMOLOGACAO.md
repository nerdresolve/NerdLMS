# NerdResolve LMS — homologação de usuários e acesso

**Endereço:** `lms.exemplo.com`

Localmente, `https://localhost` — o Caddy emite certificado interno e o
navegador avisa; é esperado. Com o domínio real, ele obtém certificado da
Let's Encrypt sozinho, desde que o DNS já aponte para o servidor e a porta 443
esteja acessível. O endereço vem de `SITE_ADDRESS` no `infra/.env`; não há
domínio fixo em código.

Os cinco perfis abaixo existem **no banco**, criados pelo seed. Servem para
percorrer a plataforma pelos quatro papéis sem depender de cadastro manual.

## Credenciais

O identificador diz a função, não um nome inventado — assim quem testa sabe o
que está exercitando. **A senha é o login sem o ponto.**

| Papel | Entrar com | Senha | Nome exibido | Projeto |
|---|---|---|---|---|
| Aluno | `user.mock` | `usermock` | Maria Souza | Escola Social |
| Instrutor | `instructor.mock` | `instructormock` | Rafael Nunes | Águas do Rio |
| Instrutor | `instructor2.mock` | `instructor2mock` | Camila Prado | — |
| Gestor | `manager.mock` | `managermock` | Sérgio Bastos | Prolagos |
| Administrador | `admin.mock` | `adminmock` | Ana Ribeiro | Holding |

O e-mail completo (`admin.mock@exemplo.com.br`) também funciona — a consulta
aceita as duas formas.

> **Estas credenciais são de homologação e não podem existir em produção.**
> Senha derivada do login é adequada para um ambiente de teste e inaceitável
> fora dele. O seed recusa rodar sem a flag `-v allow_seed=yes`, justamente
> para não entrar em produção por descuido.

## Como aplicar o seed

```bash
npm run up                                  # sobe banco, storage, app e proxy
npm run migrate                             # cria o schema (001 e 002)
npm run seed                                # popula os dados de HML
```

O seed é **reaplicável**: rodar de novo atualiza as linhas em vez de duplicar.

### Regenerar depois de mexer nos dados fictícios

```bash
npm run build:seed
```

`infra/db/seeds/hml.sql` é **gerado**, não escrito à mão. A fonte é
`apps/frontend/src/mocks/data.ts`. Editar o SQL diretamente faria o banco contar
uma história diferente da que gerou os dados.

## O que o seed cria

| Tabela | Linhas |
|---|---|
| `users` | 13 |
| `courses` | 7 |
| `modules` | 20 |
| `lessons` | 84 |
| `enrollments` | 20 |
| `lesson_progress` | 164 |
| `comments` | 3 |

Cinco perfis têm senha; a turma entra sem senha, no estado "convidado", para as
telas de gestão terem gente de verdade — equipe, engajamento, usuários ativos.

A Maria tem 4 matrículas com progresso real: um curso concluído, os outros em
andamento. É o que faz o painel mostrar 72%, e não uma tela vazia.

## Trocar de papel sem login (só em desenvolvimento)

```bash
NERDRESOLVE_DEV_ROLE=admin npm run dev
```

Aceita `admin`, `manager`, `instructor` e `learner`. **Ignorado em produção**:
lá o papel vem de sessão autenticada e de mais nada.

## Como a autenticação funciona hoje

```
tela de login  →  POST /api/auth/login  →  @nerdlms/backend/auth/login-use-case
                                                   ↓
                                        users-repository (Postgres)
                                                   ↓
                                        @nerdlms/core/auth/login (decide)
                                                   ↓
                                        sessão + cookie __Host-nerdlms-session
```

- **Senha**: hash scrypt com sal por usuário, nos parâmetros da OWASP. O banco
  nunca guarda senha em texto, e o hash nunca sai da camada de servidor.
- **Cookie**: `HttpOnly`, `Secure`, `SameSite=Lax`, prefixo `__Host-`. Fora do
  alcance de qualquer script na página.
- **Sessão**: o banco guarda o **hash** do token, não o token. Vazamento do
  banco não dá sessões reutilizáveis.
- **Mensagem de erro**: a mesma para senha errada e conta inexistente —
  distinguir diria a um atacante quais contas existem.
- **Bloqueio**: 10 falhas por IP em 15 minutos e o login passa a recusar.

## Recuperação de senha

O fluxo está completo do lado do servidor: token com hash no banco, validade de
1 hora, uso único, troca de senha e encerramento das sessões abertas.

O envio tem dois modos, em `MAIL_TRANSPORT`:

- **`log`** (padrão, e o que HML usa) — grava a mensagem no log em vez de
  enviar. Basta para percorrer o fluxo inteiro sem depender de caixa de e-mail:

  ```bash
  npm run logs                   # o link aparece aqui
  ```

- **`smtp`** — envia de verdade, por qualquer servidor SMTP. Precisa de
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASSWORD` no `.env`. **É o modo
  de produção**: com `log`, a recuperação não chega a ninguém.

A porta define como o TLS começa — 465 é cifrado desde o primeiro byte, 587
sobe por STARTTLS. Em 587 o envio **exige** STARTTLS: um servidor que não o
ofereça faz a entrega falhar em vez de mandar a senha em texto claro.

Qualquer outro valor em `MAIL_TRANSPORT` descarta o e-mail e avisa no log — não
silencia.

## O que ainda não é real

- **Materiais, trilhas, eventos e avisos ainda vêm do mock.** As tabelas
  existem e nada escreve nelas: upload de material e gestão de trilha não
  entraram. Curso, matrícula, progresso, comentário, usuário e auditoria já são
  do banco.
- **Certificado em PDF e exportação CSV estão feitos**, com gerador próprio e
  sem dependência nova. O CSV abre no Excel (BOM de UTF-8 e ponto e vírgula).
- **"Configurações" continua fora da navegação**: a tela não existe e o link
  levava a 404.

---

<sub>**NerdResolve LMS** · Documentação de produto · © 2026 Matheus Mariath (mariathdev) — NerdResolve.<br>Uso comercial requer licença: ver [LICENSE.md](../LICENSE.md).</sub>
