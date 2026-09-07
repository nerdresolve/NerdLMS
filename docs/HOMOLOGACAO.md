# Homologação: contas e acesso

**Endereço:** o que estiver em `SITE_ADDRESS`, no `infra/.env`. Não há domínio
fixo em código — trocar de endereço é editar uma linha e apontar o DNS.

Localmente, `http://localhost:8080`. Com HTTPS local, `https://localhost`: o
Caddy emite certificado interno e o navegador exibe aviso, o que é esperado. Com um
domínio real, ele obtém certificado da Let's Encrypt sozinho, desde que o DNS
já aponte para o servidor e a porta 443 esteja acessível.

---

## Credenciais

Cinco contas, uma por papel. **O nome exibido é a função, não um nome
inventado**: numa apresentação, "Ana Ribeiro" não diz de qual visão se trata,
e "Administrador" diz. **A senha é o login sem o ponto.**

| Papel | Entrar com | Senha | Nome exibido | Campo |
|---|---|---|---|---|
| Aluno | `user.mock` | `usermock` | Aluno | Siririzinho |
| Instrutor | `instructor.mock` | `instructormock` | Instrutor | Unidade Norte |
| Instrutor | `instructor2.mock` | `instructor2mock` | Instrutor 2 | Riachuelo |
| Gestor | `manager.mock` | `managermock` | Gestor | Unidade Norte |
| Administrador | `admin.mock` | `adminmock` | Administrador | Sede |

O e-mail completo (`admin.mock@exemplo.com`) também funciona: a consulta
aceita as duas formas.

Além dessas, oito pessoas com nome próprio e sem senha, no estado "convidado".
Elas existem para popular as telas de gestão, engajamento e usuários ativos, e
não para realizar login.

> **Estas credenciais são de homologação e não podem existir em produção.**
> Senha derivada do login é adequada para um ambiente de teste e inaceitável
> fora dele. A carga exige a flag `-v allow_seed=yes` para ser executada, o que
> impede a aplicação acidental em ambiente produtivo.

---

## O seed traz conteúdo fictício junto

```bash
npm run up        # sobe banco, storage, app e proxy
npm run migrate   # cria o schema
npm run seed      # LEIA O AVISO ABAIXO
```

> **`npm run seed` não é só contas.** Ele insere também **7 cursos inventados**,
> 20 módulos, 84 aulas, 7 provas, 20 matrículas e 164 registros de progresso.
> Todo `INSERT` é `ON CONFLICT DO UPDATE`, então rodá-lo num banco que já tem o
> conteúdo real da organização **traz os cursos fictícios de volta**, e o
> catálogo passa a misturar os dois.
>
> Num banco vazio, é o caminho mais rápido para ter com quem entrar. Num banco
> em uso, não execute: as contas já estão cadastradas.

O conteúdo real é importado por outro caminho:

```bash
node infra/tools/import-cursos.mjs     # 7 cursos reais, idempotente
node infra/tools/cenario-demo.mjs      # progresso para demonstrar
```

### Como o ambiente foi montado hoje

Banco recriado do zero, com **só os usuários** do seed e os cursos reais por
cima. Foi preciso recriar em vez de apagar: os gatilhos de somente-inserção em
`audit_log`, `xapi_statements` e `grade_entries` recusam remover curso,
matrícula ou nota com uso registrado, e é assim que deve ser.

```bash
npm run down
docker volume rm nerdlms-local_db-data
npm run migrate
# aplicar do hml.sql apenas os INSERT de users
node infra/tools/import-cursos.mjs
node infra/tools/cenario-demo.mjs
```

### Regenerar os dados fictícios

```bash
npm run build:seed
```

`infra/db/seeds/hml.sql` é **gerado**, não escrito à mão. A fonte é
`apps/frontend/src/mocks/data.ts`. Editar o SQL diretamente faria o banco contar
uma história diferente da que gerou os dados.

---

## O cenário de demonstração

Os vídeos reais têm de 56 a 85 minutos e a trava do player é real: ninguém
conclui um curso ao vivo. `cenario-demo.mjs` grava o progresso que uma pessoa
teria depois de assistir, nas mesmas tabelas que o uso normal escreve, e deixa
o Aluno com um curso em cada estado que a regra produz:

| Curso | Estado | O que a tela mostra |
|---|---|---|
| `1007-pe-00022` | intocado | "Falta 1 aula para liberar", botão desabilitado |
| `1001-pr-0006` | aulas concluídas | "Fazer a prova" liberado |
| `1014-pe-0004` | reprovado 4,0 | "Solicitar reteste" |
| `1022-pe-00022` | reprovado 6,0 | "Aguardando o instrutor", e o pedido na fila |
| `1001-pe-0003` | aprovado 10,0 | "Baixar certificado" |
| Consciência Negra | concluído | curso sem prova, fecha só com a aula |
| My Ahgora | intocado | curso sem prova, ainda não começado |

A fila de pedidos de reteste fica em `/instrutor/correcao`, para
`instructor.mock`.

---

## Trocar de papel sem login (só em desenvolvimento)

```bash
NERD_DEV_ROLE=admin npm run dev
```

Aceita `admin`, `manager`, `instructor` e `learner`. **Ignorado em produção**:
lá o papel vem de sessão autenticada e de mais nada.

---

## Como a autenticação funciona

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
- **Mensagem de erro**: idêntica para senha incorreta e conta inexistente, para
  não revelar quais contas existem.
- **Bloqueio**: 10 falhas por IP em 15 minutos e o login passa a recusar.

### Entrar pela conta da empresa

LDAP/Active Directory, SAML 2.0, Google e Microsoft estão implementados, e o
papel na plataforma vem do grupo no diretório. A configuração é por tenant, em
`/admin/acesso`, e o passo a passo está em [`../WHITELABEL.md`](../WHITELABEL.md).

**O diretório da organização está configurado e DESLIGADO.** A validação foi
provada contra o Active Directory real, mas a plataforma segue com senha local
até alguém decidir virar a chave:

```sql
UPDATE ldap_directories SET enabled = true WHERE kind = 'ad';
```

Com `allow_password_login = false` no diretório, a senha local deixa de valer
para aquele tenant: quem entra, entra pelo Active Directory. É o modo de
produção, e é o que fecha a porta de contas locais paralelas. `require_group`,
na mesma tabela, exige que o usuário pertença a um dos grupos mapeados. Sem
essa exigência, qualquer conta válida do domínio seria autenticada como aluno.

---

## Recuperação de senha

O fluxo está completo do lado do servidor: token com hash no banco, validade de
1 hora, uso único, troca de senha e encerramento das sessões abertas.

O envio tem dois modos, em `MAIL_TRANSPORT`:

- **`log`** (usado em homologação): grava a mensagem no log em vez de enviar. Basta para percorrer o fluxo inteiro sem depender de caixa de e-mail:

  ```bash
  npm run logs                   # o link aparece aqui
  ```

- **`smtp`**: envia por servidor SMTP. Exige
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASSWORD` no `.env`. **É o modo
  de produção**: com `log`, a recuperação não chega a ninguém.

A porta define o início do TLS: 465 é cifrado desde o primeiro byte, e 587
negocia por STARTTLS. Em 587 o envio **exige** STARTTLS: um servidor que não o
ofereça faz a entrega falhar em vez de mandar a senha em texto claro.

Qualquer outro valor em `MAIL_TRANSPORT` descarta o e-mail e registra o
descarte no log.

---

## O que conferir antes de liberar

Os portões, que não precisam de rede:

```bash
npm run verify
```

E, na aplicação, o roteiro abaixo. A existência do registro no banco não
garante que a tela apresente o estado corretamente:

1. Entrar como Aluno e percorrer os sete cursos. Cada um mostra um estado
   diferente do bloco de prova (a tabela acima).
2. Reprovar, pedir reteste, entrar como Instrutor em `/instrutor/correcao`,
   liberar com comentário, voltar como Aluno e refazer.
3. Emitir o certificado do curso aprovado e conferir o código em `/validar`.
   Um código incompleto ou inventado precisa ser recusado.
4. No editor: publicar curso sem aula (recusa e explica), criar módulo e aula
   sem título (o campo barra e diz o que falta).

## O que ainda não é real

- **O domínio do certificado.** O endereço de conferência vem de
  `tenants.domain`. Com a coluna vazia, o rodapé imprime "Confira o código com
  a área de treinamento" — o código é válido e a conferência funciona, mas quem
  recebe o documento não tem para onde ir sozinho. Ver `docs/DEPLOY.md`.
- **Backup** não está configurado. RPO e RTO precisam ser decididos antes da
  produção.
- **O seed de homologação e o conteúdo real convivem mal.** Enquanto
  `hml.sql` carregar cursos inventados, rodar `npm run seed` num banco em uso
  suja o catálogo. Ver o aviso lá em cima.
