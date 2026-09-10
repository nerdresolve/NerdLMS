# A nossa plataforma, por inteiro

Documentação funcional e técnica do EAD da organização. Este é o documento
longo: o que existe, como funciona e **por que** foi feito assim. Para começar
rápido, o [`../README.md`](../README.md); para a apresentação,
[`ROTEIRO-APRESENTACAO.md`](./ROTEIRO-APRESENTACAO.md).

**Estado em 27 de agosto de 2026**: 35 telas, 38 migrações, 81 tabelas,
1.214 testes automatizados, 7 cursos reais importados.

---

## Sumário

1. [Por que construímos a nossa](#1-por-que-construímos-a-nossa)
2. [Aprender: da matrícula ao certificado](#2-aprender-da-matrícula-ao-certificado)
3. [Avaliar: nota, reprovação e reteste](#3-avaliar-nota-reprovação-e-reteste)
4. [Certificado e validação pública](#4-certificado-e-validação-pública)
5. [Ensinar: o editor de curso](#5-ensinar-o-editor-de-curso)
6. [Gerir: equipe, auditoria e plataforma](#6-gerir-equipe-auditoria-e-plataforma)
7. [Entrar: senha e conta da empresa](#7-entrar-senha-e-conta-da-empresa)
8. [Uma instalação que aguenta mais de uma organização](#8-uma-instalação-que-aguenta-mais-de-uma-organização)
9. [Interoperabilidade](#9-interoperabilidade)
10. [Arquitetura](#10-arquitetura)
11. [Conteúdo real](#11-conteúdo-real)
12. [Operação](#12-operação)
13. [O que ainda não existe](#13-o-que-ainda-não-existe)

---

## 1. Por que construímos a nossa

A licença atual trava em **500 usuários ativos** para a organização inteira. O
limite é comercial, não técnico: cada pessoa a mais é negociação, e o
planejamento de treinamento passa a depender de quando dá para renegociar.

O segundo custo é menos visível e pesa mais no longo prazo. Quem treinou, em
quê, com que nota e em que data fica na base de um fornecedor. Numa auditoria,
a resposta depende de pedir a ele. Se o contrato acaba, o histórico é o que
ele exportar.

Com a plataforma sob gestão própria, o limite deixa de existir e o histórico
passa a ser mantido internamente. Os recursos adicionais implementados no
período (provas com nota, certificado verificável e autenticação pelo Active
Directory) decorrem dessa autonomia de desenvolvimento.

---

## 2. Aprender: da matrícula ao certificado

### Matrícula

Três caminhos, e a diferença importa para treinamento obrigatório:

| Modo | Quem inicia |
|---|---|
| Aberta | a própria pessoa, pelo catálogo |
| Atribuída | o gestor coloca a equipe |
| Por turma | um grupo com data e instrutor |

O aluno matricula **a si mesmo e a mais ninguém**. O gestor matricula a equipe
**do próprio projeto**.

### A trava do player

Sem controle de progresso, a conclusão de uma aula depende apenas de um
clique, e o registro de treinamento passa a atestar um conteúdo que pode não
ter sido assistido. Em treinamento de segurança operacional, esse registro é
usado como evidência de capacitação.

Três regras, em `packages/core/src/courses/watch-guard.ts`:

1. **Cobertura de 90%** do vídeo antes de liberar a conclusão.
2. **Tempo compatível.** A duração da sessão precisa ser coerente com o
   trecho assistido, o que impede contabilizar vídeo em reprodução sem
   acompanhamento.
3. **Sem avanço** além do ponto mais distante já alcançado. O retrocesso é
   liberado; o avanço para trecho não assistido, não.

**A velocidade de reprodução pode chegar a 2x.** A restrição de velocidade
tenderia a induzir o comportamento que o controle pretende evitar, com o vídeo
em reprodução sem acompanhamento.

> **Correção aplicada durante o desenvolvimento.** A primeira implementação
> gravava o progresso mesmo quando o avanço era bloqueado. Em teste, cem
> requisições consecutivas alcançaram 81% de um vídeo não assistido, porque a
> tolerância era consumida a cada chamada em vez de por ponto de referência. A
> versão atual não grava quando o avanço é bloqueado.

### Formatos de aula

Vídeo (MP4), documento (PDF, com contagem de páginas lidas), texto, link
externo, conteúdo interativo e pacote **SCORM 1.2 / 2004**.

O arquivo é transferido diretamente ao armazenamento por URL assinada de curta
duração, sem passar pela aplicação. Um arquivo de duas horas trafegando pelo
processo comprometeria o tempo de resposta das demais páginas.

### Conclusão do curso

Um curso está concluído quando **as aulas terminaram e a prova foi aprovada**.
Quatro estados, em `packages/core/src/courses/completion.ts`:

| Estado | Significa |
|---|---|
| `nao-comecou` | matriculado, nada visto |
| `em-andamento` | aulas em curso |
| `falta-prova` | aulas concluídas, prova pendente ou reprovada |
| `concluido` | aulas **e** prova |

Nesse estado o cartão do curso exibe **"Falta a prova"**, e não "100%". O
percentual refere-se apenas às aulas, e o número isolado seria interpretado
como conclusão do curso.

---

## 3. Avaliar: nota, reprovação e reteste

### A escala

Nota de **0 a 10**, aprovação em **8,0**.

A coluna do banco permanece em percentual. A conversão reescreveria todas as
notas já lançadas, e migrações que alteram histórico são difíceis de auditar
posteriormente. A escala de 0 a 10 é aplicada na apresentação.

O arredondamento usa uma casa decimal. Duas casas indicariam uma precisão que
uma prova de cinco questões não tem. A aprovação segue o valor exibido: 79,96%
são apresentados como 8,0 e aprovados, para que a nota exibida e a decisão
coincidam.

### A prova exige as aulas

O botão permanece **desabilitado** e informa quantas aulas faltam. Na versão
anterior o botão ficava habilitado e a tentativa era recusada em uma tela de
erro, que retirava o aluno da página do curso.

### Reteste por pedido

Quem reprova tem **uma tentativa**. Refazer depende de pedir ao instrutor.

```
aluno reprova → pede reteste (justificativa opcional)
             → instrutor decide em /instrutor/correcao (comentário OBRIGATÓRIO)
             → aprovado: +1 tentativa   |   recusado: fica registrado o porquê
```

**Sobre a opção por tentativa única.** Com tentativas livres, a primeira prova
passa a funcionar como simulado, e a reprovação não fica registrada em lugar
nenhum. Exigir o pedido mantém o registro da reprovação e da decisão que
concedeu a nova tentativa.

**A justificativa do aluno é opcional; o comentário do instrutor é
obrigatório.** O comentário registra o motivo da concessão, informação
necessária em auditoria, e comunica ao aluno a razão da recusa. A
obrigatoriedade está implementada no código e em um `CHECK` da migração 038,
de modo que um `INSERT` executado fora desse caminho também é recusado.

**Um pedido em aberto por vez**, garantido por índice único parcial. Sem essa
restrição, dois cliques criariam dois pedidos, e a aprovação de ambos
concederia duas tentativas.

### Correção de dissertativa

Prova com questão aberta permanece em `needs_review`, e a nota é fechada
somente após a correção do instrutor. O lançamento antecipado gravaria um
percentual sujeito a alteração.

---

## 4. Certificado e validação pública

O PDF é gerado por código próprio, sem dependência externa, e traz nome, curso,
carga horária, data de conclusão, **assinatura do instrutor responsável** e um
código de verificação no rodapé.

### A validação é real

`/validar?codigo=XXXXXXXXXXXX`, sem exigência de login, uma vez que o
destinatário do certificado normalmente não possui conta na plataforma.

A conferência olha **três coisas**: a matrícula existe, o curso foi concluído e
a nota alcançou o mínimo.

> **Sobre a verificação de nota.** Na implementação anterior, a checagem
> considerava apenas as aulas. Um curso com prova obrigatória recusava a *emissão* por
> falta de nota, enquanto `/validar` respondia "válido" para a mesma matrícula:
> quem reprovasse poderia divulgar o código e a conferência confirmaria um
> documento que nunca foi emitido. A regra passou a ser a mesma nos dois
> pontos, o que evita que duas definições de conclusão divirjam ao longo do
> tempo.

Código inválido recebe a resposta **"Código não confere"**, sem indicar se a
matrícula existe, se houve reprovação ou qual das três condições falhou. A
distinção entre esses casos revelaria informação a quem não deveria tê-la.

---

## 5. Ensinar: o editor de curso

Curso → módulos → aulas. Reordenação por arrastar. Envio de vídeo, PDF e
pacote SCORM.

**A fronteira é a autoria.** O instrutor cria à vontade e edita, publica ou
arquiva **só o que é dele**. Acompanha o progresso dos alunos dos próprios
cursos e não o altera.

**Não existe excluir curso.** Apagar levaria junto matrícula, progresso e
comentários, e o certificado já emitido deixaria de conferir no validador.
Arquivar é o caminho: o curso sai do catálogo e para de aceitar matrícula, mas
quem já cursava continua com acesso, inclusive ao certificado.

**Publicar exige ao menos uma aula.** A contagem vem do banco, não do que o
cliente afirma: publicar um curso vazio deixaria gente matriculada em nada.

**Campos obrigatórios bloqueiam o envio e informam o que falta.** A mensagem é
definida pela aplicação, e não pelo navegador: a mensagem padrão do navegador
segue o idioma da interface dele, e exibiria *"Please fill out this field."* em
uma instalação configurada em português.

---

## 6. Gerir: equipe, auditoria e plataforma

**Gestor**: painel do próprio projeto e da própria equipe. Quem concluiu, quem
está atrasado, quem nem começou. Matricula em treinamento obrigatório. Não
edita conteúdo.

**Administrador**: pessoas e papéis, importação em massa por CSV, acesso e SSO,
auditoria, competências, distintivos, integrações, marca, recursos ligados,
textos de e-mail e backup.

### Auditoria

`audit_log` é **somente-inserção**: `UPDATE` e `DELETE` revogados até para a
aplicação, com gatilho que recusa mesmo se alguém reconceder por engano.
Registro que se pode editar não é registro.

A tabela armazena `actor_name` separadamente de `actor_id`, e a chave usa
`ON DELETE SET NULL`, de modo que o desligamento de um funcionário não remove
o registro das ações executadas por ele.

O mesmo vale para `xapi_statements` e `grade_entries`.

### Recursos que se pode desligar

Por organização: comentários, fórum, notificações, trilhas, agenda, gamificação,
certificados, favoritos e busca global. A desativação remove a tela e também
a rota, de modo que o acesso direto pelo endereço não funciona.

**As recompensas com contrapartida financeira foram removidas.** Itens que
exigiriam compra pela empresa vinculariam a gamificação a um orçamento, e a
plataforma passaria a oferecer benefícios cuja entrega não depende dela.

---

## 7. Entrar: senha e conta da empresa

Detalhe completo em [`PERFIS-E-ACESSOS.md`](./PERFIS-E-ACESSOS.md). Em resumo:

- **Senha local**: scrypt com sal por usuário, parâmetros da OWASP.
- **Sessão**: o banco guarda o *hash* do token, não o token.
- **Cookie**: `HttpOnly`, `Secure`, `SameSite=Lax`, prefixo `__Host-`.
- **Erro genérico** para senha errada e conta inexistente.
- **Bloqueio** de 10 falhas por IP em 15 minutos.

### LDAP e Active Directory

Implementado do zero: codificação BER, `BindRequest`, `SearchRequest`, leitura
das respostas e dos sub-códigos que o AD esconde no diagnóstico
(`data 52e`, `533` e `532`, entre outros).

**O filtro é uma árvore BER, não um texto montado.** O valor digitado viaja
num `OCTET STRING` e seus bytes nunca são lidos como sintaxe: quem digitar
`*)(objectClass=*` não transforma "quem é fulano?" em "me devolva todo mundo".
A categoria de injeção de filtro **não se aplica por construção**. O teste que
cobre esse comportamento compara os bytes com o RFC 4511, e não com o próprio
codificador, o que ocultaria um erro simétrico.

O papel vem do **grupo no diretório**, com o mais alto vencendo. Quem entra no
grupo de instrutores vira instrutor; quem sai, deixa de ser.

Duas travas de produção: `allow_password_login = false` (senha local deixa de
valer) e `require_group = true` (sem grupo mapeado, não entra).

**Hoje está desligado.** Foi provado contra o AD real da organização; ligar é
uma linha de SQL, e é decisão de quem opera.

### SAML 2.0, Google e Microsoft

Também implementados, com verificação de assinatura própria. A configuração
fica em `/admin/acesso`.

---

## 8. Uma instalação que aguenta mais de uma organização

Hoje existe **um tenant só**, o da organização, e todo curso, pessoa e nota
pertence a ele. Mas a plataforma foi construída sabendo separar organizações:
`tenant_id` está em **42 tabelas**, e nada atravessa de uma para outra.

**Isso importa para nós por duas razões, e nenhuma delas é vender a plataforma
para terceiros.**

A primeira é hoje. O recorte é o mesmo mecanismo que garante que uma consulta
mal escrita não devolva dado de fora do escopo pedido. Ele é exercitado a cada
build por `apps/backend/src/tenancy/query-isolation.test.ts`, que **falha** se
alguém escrever uma consulta sem o recorte. É a única garantia que sobrevive a
quem não leu a documentação.

A segunda é o dia em que a organização quiser treinar **quem não é
funcionário**: terceirizado em campo, empresa parceira, fornecedor que precisa
da integração de segurança antes de entrar na área. Esse público não pode ver o
catálogo interno nem aparecer nos relatórios de RH, e não deve entrar pelo
nosso Active Directory. Com o isolamento pronto, isso é configuração; sem ele,
seria outro sistema.

Na regra de permissão, a verificação de organização precede a de papel. Na
ordem inversa, o bloco do administrador já teria autorizado o acesso antes de
a organização ser avaliada.

O passo a passo de configurar uma instalação do zero está em
[`../WHITELABEL.md`](../WHITELABEL.md). Serve para reconfigurar a nossa e para
esse cenário.

---

## 9. Interoperabilidade

| Padrão | Situação |
|---|---|
| SCORM 1.2 e 2004 | importa pacote, executa e registra |
| xAPI | envia e recebe statements |
| cmi5 | lançamento e sessão |
| LTI 1.3 | lançamento e envio de nota (AGS) |
| QTI | importa e exporta questões |
| CSV | importa usuários e questões; exporta relatório |

Todos escritos no repositório, sem biblioteca de terceiros. Isso é decisão, não
teimosia: o pacote `@nerdlms/core` **não declara nenhuma dependência de runtime**,
e é o `package.json` que prova, não uma promessa no README.

---

## 10. Arquitetura

```
packages/core/      regra de domínio. Sem framework, sem dependência.
apps/backend/       fala com PostgreSQL e com sistemas de fora.
apps/frontend/      Next.js 15 + React 19. Telas e rotas HTTP.
infra/              Docker, PostgreSQL, MinIO, Caddy.
```

**Três camadas, e a de baixo não conhece a de cima.** O domínio não sabe o que
é React, requisição HTTP ou banco. O backend não conhece Next. Isso não é
purismo: é o que faz 1.127 testes de regra rodarem em 17 segundos sem subir
nada.

### Por que não há servidor HTTP próprio

O Next já atende HTTP. Um servidor adicional exigiria segunda imagem, segundo
deploy, configuração de CORS e mais uma porta exposta, sem contrapartida no
escopo atual. As rotas são camadas finas que chamam o caso de uso; caso a API
seja extraída do Next futuramente, apenas os arquivos `route.ts` são
descartados.

### O que é derivado e o que é gravado

**Derivado por consulta**: progresso, percentual de trilha, moedas ganhas,
contagem de votos, usuários ativos. Contador gravado sai de sincronia e ninguém
percebe até o relatório sair errado.

**Gravado, porque é evento**: progresso assistido, voto dado, moeda gasta,
tentativa de prova, nota lançada, pedido de reteste, e tudo em `audit_log`.

O orçamento semanal de votos, por exemplo, é `COUNT(*)` sobre a semana ISO
corrente. Saldo gravado permitiria gastar duas vezes numa corrida entre
requisições.

### Segredos que precisam voltar

Senha de pessoa vira hash e nunca mais volta. A senha da conta de serviço do
Active Directory, não: a aplicação precisa apresentá-la ao diretório.

`apps/backend/src/crypto/secret-box.ts` cifra em AES-256-GCM com chave derivada
do `SESSION_SECRET` por HKDF, com rótulo por uso. A proteção cobre o cenário em
que o segredo sai junto com um **dump do banco**: backup copiado, ou réplica de
homologação restaurada a partir da base de produção. Ela **não** cobre execução
de código no próprio servidor, limitação registrada no cabeçalho do arquivo.

---

## 11. Conteúdo real

Sete cursos, todos procedimentos da organização. Cinco com prova (30 questões,
gabarito completo), dois sem.

Os arquivos de vídeo somam 522 MB e **não são versionados**. O repositório
armazena o JSON com estrutura, provas e gabarito. A importação é dividida em
três ferramentas, porque a transferência de vídeo é demorada e sujeita a falha
de rede, ao contrário da escrita no banco:

```bash
node infra/tools/parse-cursos.mjs <pasta>   # material → infra/db/content/cursos.json
node infra/tools/upload-cursos.mjs <pasta>  # vídeos → storage
node infra/tools/import-cursos.mjs          # cursos, aulas e provas → banco
```

Juntar upload e importação faria uma falha de rede desfazer a importação
inteira.

**Idempotente**: cada id deriva do código do procedimento, e toda escrita é
`ON CONFLICT DO UPDATE`. Rodar de novo depois de corrigir um gabarito atualiza
sem duplicar curso nem perder matrícula.

A duração é lida do cabeçalho `mvhd` do MP4 por
`infra/tools/duracao-mp4.mjs`, sem dependência de ffmpeg. Um dos vídeos está em
MP4 fragmentado e declara duração zero no cabeçalho principal; nesse caso a
duração é obtida pela soma dos fragmentos.

Título e resumo são curados numa tabela **dentro do parser**, não no JSON: o
JSON é saída e seria sobrescrito na execução seguinte.

### O cenário de demonstração

```bash
node infra/tools/cenario-demo.mjs
```

Os vídeos têm entre 56 e 85 minutos, e o controle de progresso é aplicado
integralmente, o que inviabiliza concluir um curso durante uma demonstração. O
script grava o progresso equivalente ao de quem assistiu ao conteúdo, nas
mesmas tabelas usadas em operação normal e sem marcação de registro de
demonstração. Registros que a aplicação não produziria levariam a telas que ela
não alcança em uso real.

---

## 12. Operação

### Um ambiente por projeto do Compose

| Comando | Arquivo de ambiente | Projeto Compose |
|---|---|---|
| `npm run up`, `migrate`, `seed`, `logs` | `infra/.env` | `nerdlms` |
| `npm run publish`, `migrate:tunnel` | `infra/.env` + `infra/.env.tunnel` | `nerdlms` |

**Nunca rode `docker compose` sem `-p`**: sem ele o Compose deduz o nome pela
pasta, e a dedução não distingue duas instalações na mesma máquina.

### Portões

```bash
npm run typecheck
npm run test          # 1.127 + 49 + 38
npm run lint
npm run check:sql
npm run check:imports
npm run verify        # os acima menos o typecheck, mais auditorias do protótipo
```

`verify` **não** roda `typecheck`. Antes de commitar, os dois.

### Banco

Nem PostgreSQL nem MinIO publicam porta. Só o proxy fala com a internet, e a
rede interna é `internal: true`.

A aplicação **não** usa o dono do schema: `lms_migrator` migra, `lms_app`
roda sem DDL. Se houver SQL injection, o estrago não alcança a estrutura.

> Os papéis (`lms_migrator`, `lms_app`) e o bucket (`lms-media`) levam o nome do
> produto, não o do cliente, e isso é de propósito: uma instalação atende vários
> clientes, e um nome de cliente na infraestrutura envelheceria mal. Renomeá-los
> num banco já em uso é migração de infraestrutura, com risco de deixar a
> aplicação sem conectar no meio do caminho. A migração `035_tenant_do_cliente`
> é onde a instalação declara de quem ela é.

Detalhes em [`../infra/db/README.md`](../infra/db/README.md).

---

## 13. O que ainda não existe

| Pendência | Impacto |
|---|---|
| **Domínio do certificado** | O endereço de conferência sai de `tenants.domain`, hoje vazio: o rodapé imprime uma orientação em vez de um endereço. O código é válido e a conferência funciona. **Declare o domínio depois que o DNS apontar para a instalação**, conforme `docs/DEPLOY.md`. |
| **Backup** | Não configurado. RPO e RTO precisam ser decididos. Os dois volumes (`db-data` e `storage-data`) precisam entrar na cópia: o `pg_dump` não leva os vídeos. |
| **Rollback de migração** | Cada arquivo aplica; nenhum desfaz. Ou passa a haver `down`, ou a política é restaurar backup. |
| **Seed x conteúdo real** | `npm run seed` insere 7 cursos fictícios com `ON CONFLICT DO UPDATE`. Num banco que já tem o conteúdo real, o catálogo volta a misturar os dois. Ver [`HOMOLOGACAO.md`](./HOMOLOGACAO.md). |
| **CSP** | `'unsafe-inline'` em `script-src` (ISSUE-028). Nenhuma origem externa executa script, mas a proteção contra inline injetado está aberta. |
| **Catálogo definitivo** | Sete cursos entraram. O resto depende do RH. |
| **Particionamento de `audit_log`** | Não é problema no primeiro ano; é no terceiro. |

O raciocínio de cada decisão técnica, numerada, está em
[`progress.md`](./progress.md).
