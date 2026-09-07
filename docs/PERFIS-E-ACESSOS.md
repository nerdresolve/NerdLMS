# Perfis e acessos

Atribuições de cada papel na plataforma de ensino da Exemplo S.A., as restrições
de permissão aplicadas a cada um, e as contas usadas em homologação.

As regras descritas aqui foram verificadas na aplicação em execução, e não
inferidas a partir do código-fonte.

> Há uma versão em PDF, com a identidade visual da empresa, em
> [`NerdResolve-Energy-Perfis-e-Acessos.pdf`](./NerdResolve-Energy-Perfis-e-Acessos.pdf).
> O conteúdo é o mesmo. Para regerar após alterar alguma regra:
>
> ```bash
> npm run guia:perfis
> ```

---

## Contas de homologação

O nome exibido corresponde à função da conta, o que facilita identificar qual
visão está sendo demonstrada. **A senha é o login sem o ponto.**

| Papel | Entrar com | Senha | Nome exibido | Campo |
|---|---|---|---|---|
| Aluno | `user.mock` | `usermock` | Aluno | Siririzinho |
| Instrutor | `instructor.mock` | `instructormock` | Instrutor | Unidade Norte |
| Instrutor | `instructor2.mock` | `instructor2mock` | Instrutor 2 | Riachuelo |
| Gestor | `manager.mock` | `managermock` | Gestor | Unidade Norte |
| Administrador | `admin.mock` | `adminmock` | Administrador | Sede |

O e-mail completo (`admin.mock@exemplo.com`) também é aceito no campo de
login.

O cadastro inclui ainda oito usuários com nome próprio e sem senha, no estado
convidado. Eles não realizam login, e existem para popular as telas de gestão,
equipe e engajamento.

> **As contas acima são de homologação e não devem ser criadas em produção**,
> por terem senha derivada do login. A carga dos dados de homologação exige a
> flag `-v allow_seed=yes` para ser executada, o que impede a aplicação
> acidental em ambiente produtivo.

---

## Atribuições por perfil

### Aluno

Papel padrão, atribuído a toda pessoa criada a partir do Active Directory da
Exemplo S.A..

| Tela | Função |
|---|---|
| `/dashboard` | retomada do último ponto, progresso e prazos |
| `/meus-cursos` | cursos em que está matriculado |
| `/cursos` | catálogo, com matrícula própria nos cursos de inscrição aberta |
| `/concluidos` | cursos finalizados, incluindo aulas e prova |
| `/favoritos` | cursos marcados |
| `/trilhas` | sequências de cursos |
| `/conquistas` | distintivos e nível |
| `/agenda` | calendário e avisos |
| `/cursos/<slug>` | página do curso, com o bloco de avaliação |
| `/aulas/<id>` | player, com controle de progresso |
| `/provas/<id>` | prova, quando liberada |
| `/perfil` | dados, certificados, assinatura e preferências de notificação |

**Restrições.** As rotas `/admin`, `/instrutor/*` e `/gestor/*` retornam HTTP
404. A escolha de 404 em vez de 403 evita confirmar a existência da tela a quem
não tem permissão para acessá-la.

O aluno consulta e grava apenas o próprio progresso, e realiza matrícula apenas
para si mesmo.

### Instrutor

Responsável pelo conteúdo. As permissões de edição são delimitadas pela autoria:
cada instrutor altera apenas os cursos que criou.

| Tela | Função |
|---|---|
| `/instrutor/cursos` | cursos de sua autoria |
| `/instrutor/cursos/<id>` | editor: módulos, aulas, mídia e prova |
| `/instrutor/correcao` | correção de dissertativas e fila de pedidos de reteste |
| `/instrutor/engajamento` | pontos de abandono do vídeo, por aula |
| `/perfil` | inclui o envio da assinatura aplicada aos certificados |

**Restrições.** Não edita, publica ou arquiva curso de outro instrutor. Não
realiza matrícula, atribuição que pertence ao gestor. Consulta o progresso dos
alunos dos seus cursos, sem permissão de alteração.

A identificação de Professor em comentários exige papel de instrutor e autoria
do curso. Ela indica autoria do conteúdo, e não hierarquia, razão pela qual não
é atribuída ao administrador.

### Gestor

Acompanha a equipe. Todas as consultas são delimitadas pelo projeto ao qual o
gestor pertence.

| Tela | Função |
|---|---|
| `/gestor` | indicadores do projeto |
| `/gestor/equipe` | pessoas do projeto, com andamento individual |

**Restrições.** Não consulta pessoas de outro projeto. Não cria nem edita
conteúdo, atribuição que pertence ao instrutor. Não decide pedidos de reteste.
As consultas de análise são limitadas ao escopo `project` do próprio projeto.

O gestor realiza matrícula atribuída, usada para inscrever a equipe em
treinamento obrigatório.

### Administrador

Acesso amplo à plataforma, com três restrições definidas em projeto.

| Tela | Função |
|---|---|
| `/admin` | painel geral |
| `/admin/usuarios` | convite, papel, situação e importação em massa |
| `/admin/acesso` | Active Directory, SAML, Google e Microsoft |
| `/admin/auditoria` | registro de ações, com autor e data |
| `/admin/analytics` | análise consolidada |
| `/admin/competencias` | mapa de competências |
| `/admin/badges` | distintivos |
| `/admin/integracoes` | LTI, xAPI e webhooks |
| `/admin/plataforma` | marca, recursos habilitados, textos de e-mail e backup |

**As três restrições:**

1. **Dados de outra organização.** A verificação de `tenant_id` precede a regra
   de papel. Como existe uma organização cadastrada, a restrição não é
   exercida atualmente; ela se aplica ao cenário de treinamento a
   terceirizados ou parceiros, com catálogo separado do interno.
2. **Identificação de Professor.** Não é atribuída, conforme descrito no perfil
   de Instrutor.
3. **Edição de comentário de outro autor.** A moderação disponível é a remoção,
   que fica registrada em auditoria. A edição permitiria alterar o sentido de
   uma mensagem mantendo a autoria original.

As ações do administrador são registradas em auditoria.

---

## Como a autorização é resolvida

A decisão é tomada por uma única função, `can(ator, ação, recurso)`, em
`packages/core/src/auth/permissions.ts`. Ela não depende de HTTP nem de banco:
recebe o ator, a ação e o recurso, e retorna a autorização.

A mesma função é chamada pela interface e pelas rotas da API, de modo que a
permissão exibida na tela e a aplicada no servidor não divergem.

A ordem de avaliação é a seguinte:

| Ordem | Verificação |
|---|---|
| 1 | **Organização.** Recursos de outra organização são negados antes de qualquer verificação de papel. |
| 2 | **Administrador.** Autorizado, exceto nas três restrições acima. |
| 3 | **Gestor.** Autorizado dentro do projeto ao qual pertence. |
| 4 | **Instrutor e Aluno.** Avaliados por autoria do curso e por matrícula. |

### Restrições verificadas

As tentativas abaixo foram executadas na aplicação. Todas retornam HTTP 404.

| Perfil | Rotas | Resposta |
|---|---|---|
| Aluno | `/admin`, `/admin/usuarios`, `/admin/auditoria` | 404 |
| Aluno | `/instrutor/cursos`, `/instrutor/correcao` | 404 |
| Aluno | `/gestor/equipe` | 404 |
| Instrutor | `/admin/usuarios`, `/admin/auditoria`, `/admin/plataforma` | 404 |
| Gestor | `/admin/usuarios`, `/admin/plataforma` | 404 |
| Gestor | `/instrutor/correcao` | 404 |

---

## Autenticação corporativa

A plataforma suporta LDAP/Active Directory, SAML 2.0, Google e Microsoft. O
papel atribuído ao usuário é derivado do grupo a que ele pertence no diretório,
o que dispensa manutenção de cadastro em duplicidade. A configuração fica em
`/admin/acesso`.

**A integração com o Active Directory da Exemplo S.A. está configurada e
desabilitada.** A autenticação foi validada contra o diretório de produção,
incluindo a interpretação dos sub-códigos de erro retornados pelo AD. A
plataforma opera com senha local até que a integração seja habilitada:

```sql
UPDATE ldap_directories SET enabled = true WHERE kind = 'ad';
```

Duas colunas da mesma tabela definem o nível de exigência:

- **`allow_password_login = false`**: a senha local deixa de ser aceita, e o
  login passa a ocorrer exclusivamente pelo diretório. É a configuração de
  produção, e impede a permanência de contas locais fora do controle do AD.
- **`require_group = true`**: exige que o usuário pertença a um dos grupos
  mapeados. Sem essa exigência, qualquer conta válida do domínio seria
  autenticada com papel de aluno.

O procedimento completo de configuração está em
[`../WHITELABEL.md`](../WHITELABEL.md).

---

## Segurança do login

| Item | Implementação |
|---|---|
| Senha | Hash scrypt com sal por usuário, nos parâmetros recomendados pela OWASP. O banco não armazena senha em texto. |
| Cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, com prefixo `__Host-`. |
| Sessão | O banco armazena o hash do token, e não o token. |
| Mensagem de erro | Idêntica para senha incorreta e conta inexistente, para não revelar quais contas existem. |
| Bloqueio | 10 falhas por IP em 15 minutos suspendem novas tentativas. |
| Auditoria | Login, logout, alteração de papel e ações administrativas são gravados em `audit_log`. |

A tabela `audit_log` é somente-inserção. As permissões de `UPDATE` e `DELETE`
estão revogadas inclusive para o usuário da aplicação, e há um gatilho que
recusa a operação caso a permissão seja reconcedida.
