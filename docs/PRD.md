# PRD — NerdResolve LMS

> Escrito a partir do primeiro cliente (NerdResolve). O que vale como requisito de
> produto está aqui; o que era específico do cliente virou configuração.

> Onde a proposta original e a definição de perfis divergem, a divergência está
> marcada com **⚠ A CONFIRMAR** — não foi resolvida por conta própria.

---

## 1. Objetivo do produto

Substituir a plataforma licenciada atual (Brevo, R$ 5 mil/mês para 100 usuários)
por uma plataforma proprietária, com código, dados e roadmap sob governança da
NerdResolve. O ganho declarado é estratégico antes de ser financeiro: fim do lock-in
contratual, do custo por usuário e da dependência da fila de um fornecedor.

Consequência para a arquitetura: **nada de dependência proprietária que recrie o
lock-in que o projeto existe para eliminar.** Sem SaaS fechado no caminho crítico
de autenticação, vídeo ou dados.

---

## 2. Perfis de acesso

Três perfis, conforme definição do cliente:

### Admin
- Vê o engajamento geral de todos os alunos.
- Cria, edita e exclui **qualquer** curso.
- Gerencia usuários (cadastro, edição, desativação).

### Instructor
- Cria cursos; edita e exclui **apenas os de sua autoria**.
- Vê o engajamento dos alunos **matriculados nos seus cursos**.
- Responde comentários com a tag **Professor**, que destaca a resposta.

### Learner
- Vê o próprio dashboard de progresso.
- Inscreve-se em cursos.
- Comenta e responde comentários.

### Manager (Gestor)
- Acompanha o engajamento do **próprio projeto** — Águas do Rio, Prolagos,
  Regenera Rio ou Escola Social.
- Convida e gerencia pessoas **do próprio projeto**.
- **Matricula** a equipe nos treinamentos obrigatórios.
- Não cria nem edita conteúdo: isso é do Instructor.

### Decisões tomadas

As três divergências abertas foram resolvidas com base no que a proposta promete
e no que o levantamento revela. O raciocínio está registrado porque a decisão
pode ser revista, mas não deve ser revista por esquecimento.

**1. São quatro papéis, não três.** A proposta promete "Administrador, Gestor e
Aluno"; a definição do cliente falava em Admin, Instructor e Learner. Não são
listas concorrentes: são recortes diferentes que a operação precisa ao mesmo
tempo.

O Instructor tem recorte de **autoria** — vê quem cursa o material dele. O
Gestor tem recorte de **projeto** — precisa responder "como está Prolagos", e
autoria não responde isso. Como os relatórios pedidos são explicitamente por
projeto e por região, e como a NerdResolve atende quatro projetos distintos sob a
mesma plataforma, os dois papéis existem. Implementado e testado.

**2. Matrícula é dos dois jeitos, decidido por curso.** O campo
`enrollmentMode` distingue:

* `open` — o aluno se inscreve sozinho. É o caso dos **cursos livres** e da
  **Escola Social**, que mira 30 mil pessoas externas. Matricular uma a uma
  nessa escala é o gargalo que existe hoje.
* `assigned` — o Gestor matricula a equipe. É o caso do **treinamento
  obrigatório** interno.

A tela de acesso dizia "O acesso é liberado pelo seu gestor", o que era verdade
só para o segundo caso. O texto precisa mudar quando a Escola Social entrar.

**3. Provas ficam fora do MVP.** A pergunta "tem provas?" aparece no
levantamento sem resposta e **não está em nenhuma das duas listas da proposta** —
nem Mês 3, nem Mês 6. O certificado é emitido por conclusão de aulas, como a
proposta descreve ("emissão automatizada na conclusão"). Avaliação é um módulo
inteiro — banco de questões, tentativas, nota de corte, efeito no certificado — e
entra como escopo novo, com estimativa própria, se for confirmado.

**4. "Usuário ativo" é quem acessou no período.** Havia três leituras possíveis
(acessou, tem matrícula vigente, concluiu alguma aula). Escolhida a primeira
porque é o que uma **licença por usuário ativo cobra** — exatamente o teto de
500 que motivou a troca — e é o que responde "quantas pessoas realmente usam".
Implementado em `lib/courses/active-users.ts`, visível no painel do admin, com
recorte por projeto.

**5. SCORM entra no modelo agora, na interface depois.** A proposta promete
upload de "SCORM, vídeo, imagem, slide, doc" e a NerdResolve já usa. A aula ganhou
`kind`. A decisão de arquitetura que vem junto: **a conclusão de uma aula SCORM
não segue a regra dos 90%** — quem decide é o pacote, pela API dele. Duas fontes
de verdade para a mesma conclusão dariam divergência silenciosa nos relatórios.

**6. Integração SAP fica fora**, por instrução do cliente. O modelo não a
impede: basta um identificador externo no usuário quando for a hora.

**7. A tag Professor vale só nos cursos de autoria do Instructor.** É o recorte
coerente com "seus alunos" e o único que não permite a um instrutor se apresentar
como autoridade sobre material de outro.

---

## 3. Escopo — MÊS 3 (MVP em produção)

Da proposta, o que precisa existir para a NerdResolve operar sem a plataforma atual:

| Item | Estado neste repositório |
|------|--------------------------|
| Login, perfis e gestão completa de usuários | UI de login pronta; RBAC modelado e testado; API pendente |
| Catálogo de cursos, módulos, aulas | Telas prontas |
| Materiais | Estado vazio pronto; upload pendente |
| Player e tracking de progresso | Player pronto; persistência pendente |
| Matrículas simplificadas | Modelado; pendente |
| Emissão de certificados em PDF | **Não iniciado** |
| Dashboard de indicadores e relatórios exportáveis (PDF/Excel) | **Não iniciado** |
| Interface responsiva (mobile/desktop) | Pronta e validada |

A proposta também posiciona no Mês 3 dois itens de peso que **não estão no
repositório e precisam de decisão de escopo**: o **backoffice de administração**
(cadastro de módulos e aulas, upload de vídeos, PDFs e materiais) e a
**inteligência artificial integrada** (assistente para o aluno e insights para o
admin). São projetos por si só; ver §6.

---

## 4. Escopo — MÊS 6 (versão completa)

Fora do MVP, registrado para não se perder:

- Trilhas de aprendizagem encadeadas e personalizáveis.
- Gamificação: moedas NerdResolve, distintivos, loja de recompensas.
- Calendário de treinamentos, eventos e comunicados internos.
- Dashboard executivo (BI), auditoria de sistema e download em massa de certificados.
- Motor de recomendação de cursos.
- API aberta para integração com os sistemas de RH, permissões granulares (RBAC
  avançado) e otimizações de performance/escala.
- Upload de qualquer tipo de conteúdo, incluindo **SCORM**.

**Escala declarada**: de 100 até 30.000+ usuários ativos sem lentidão. Isso é um
requisito não funcional com consequência real — paginação no servidor e índices
desde o schema, não depois.

---

## 10. Decisões de tecnologia e economia

### Player de vídeo: continuamos sem framework de player

A preocupação levantada foi correta — **embed de YouTube num LMS corporativo
parece amador e traz problemas reais**: marca de terceiro, vídeos relacionados,
rastreamento, e conteúdo interno hospedado fora do controle da NerdResolve, que é
exatamente o lock-in que este projeto existe para eliminar.

Mas a solução não é adotar um player pronto. **A plataforma já tem um player
próprio**, construído sobre o `<video>` nativo com controles no design system:
play/pause, barra de posição, volume, velocidade, tela cheia e atalhos de
teclado. Não há marca de terceiro, não há rastreamento, e o vídeo é servido do
próprio domínio.

Avaliei as alternativas gratuitas: **Video.js** (Apache-2.0, maduro, ~150 kB),
**Plyr** (MIT, ~50 kB), **Vidstack** (MIT, moderno) e **Shaka Player**
(Apache-2.0, foco em streaming). Todas resolveriam, e todas custariam o mesmo:
retrabalhar o tema para caber no design system que já está aprovado, mais
50–150 kB em toda página de aula.

O que essas bibliotecas realmente entregam além do que já temos é **streaming
adaptativo** (HLS) — que importa de verdade para as aulas de até 2 horas e para
quem assiste em campo, com 4G instável. Só que isso não vem do player: vem do
**hls.js** (MIT, ~40 kB), que alimenta o `<video>` nativo e é o mesmo motor que
Video.js e Plyr usam por baixo.

**Decisão**: manter o player próprio e adotar `hls.js` quando o streaming
adaptativo entrar. Ganhamos a funcionalidade que importa, sem
importar um framework de interface para obter um recurso de rede, e sem tocar
na aparência aprovada.

### Economia de moedas: duas moedas, não uma

A proposta de usar o modelo do TabNews — votar custa moeda, receber voto rende
moeda, sem voto negativo — é boa e foi adotada. Mas **com uma correção
importante**.

No TabNews a moeda só compra visibilidade. Aqui ela também compra recompensa
real: dia de folga, kit, vale-livro. Se fosse a mesma moeda, **dar um voto
custaria um pedaço de um prêmio** — e ninguém votaria. A economia criada para
gerar interação a mataria.

Por isso são duas:

| | Moedas NerdResolve | Votos da semana |
|---|---|---|
| Como ganha | concluindo aulas e cursos, e recebendo votos | orçamento fixo semanal |
| Acumula? | sim | **não** — não usar é perder |
| Gasta em | loja de recompensas | votar em comentários |

O efeito é o pretendido: votar é gratuito em termos de prêmio, mas escasso em
termos de atenção — o comportamento premiado é **ler os comentários e escolher
os bons**. E escrever bem continua rendendo moeda de verdade, via votos
recebidos.

Regras adotadas: sem voto negativo; **não se vota no próprio comentário**;
um voto por comentário; até cinco comentários em destaque por relevância,
valendo também para respostas.

### Destaques do mês: por contribuição, não por conclusão

Reconhecimento público é bom, mas **ranquear conclusão de treinamento
obrigatório expõe quem está atrasado** e transforma exigência em competição —
numa empresa de 27 mil pessoas, com treinamento de segurança obrigatório, isso
gera constrangimento, não motivação.

A lista reconhece **quem ajudou colegas** (votos recebidos em comentários), que
é voluntário e positivo por natureza. Quem não participou simplesmente não
aparece — a lista reconhece, não expõe.

---

## 9. Contexto operacional (detalhamento do cliente)

Números e restrições que vieram do levantamento e que mudam decisões técnicas:

| Fato | Consequência |
|------|--------------|
| **27.000 colaboradores** na NerdResolve; Escola Social mira **30.000** pessoas do público externo | O catálogo e os relatórios precisam paginar no servidor desde o início. Nenhuma tela pode carregar lista completa. |
| Atende **Águas do Rio, Prolagos, Regenera Rio e Escola Social** | Existe uma dimensão **projeto/empresa** no modelo de dados, não só usuário e curso. Relatórios por projeto dependem disso. |
| Plataforma atual limita a **500 usuários ativos** para todos os projetos somados, em "ondas" de alunos | É a dor central. Na plataforma própria não há limite comercial — mas "usuário ativo" precisa ser definido para o relatório de período ativo. |
| Hoje a Kessia **cadastra aluno por aluno e envia o link** | A jornada de cadastro precisa encolher. É requisito explícito, não conveniência. |
| Customização depende da REVO | Backoffice próprio é o que elimina essa fila. |
| Conteúdo: **vídeo, PDF e SCORM** | SCORM não é "mais um upload": é um pacote com runtime próprio e API de rastreio. Precisa de decisão de escopo. |
| **~70 cursos** (social) e **6** (terceiros) | Volume modesto. O gargalo é de usuários, não de catálogo. |
| Aulas de **30 a 60 minutos**, uma de 2 horas | Vídeo de até 2h por upload próprio: pensar em tamanho de arquivo, retomada de upload e seek. |
| Cursos livres convivem com treinamentos obrigatórios | Sugere um atributo de **obrigatoriedade** no curso ou na matrícula. |
| Relatórios: **período ativo, região, projeto, cursos concluídos por pessoa** | Define as dimensões do modelo de dados. Sem `região` e `projeto` no usuário, esses relatórios não existem. |
| Gamificação desejada | Já previsto no Mês 6. |
| Trilhas personalizáveis | Já previsto no Mês 6. |
| Intenção de operar internamente (subir conteúdo, customizar, montar trilhas, gerar relatórios) | O backoffice precisa ser usável por RH, não por desenvolvedor. |

### ⚠ Perguntas ainda sem resposta

1. **Tem provas/avaliações?** Ficou como pergunta aberta no levantamento. Se
   houver, é um módulo inteiro (banco de questões, tentativas, nota de corte,
   impacto no certificado) e não está em nenhuma estimativa.
2. **O que define "usuário ativo"** para o relatório de período ativo?
3. **Escola Social e treinamentos internos** ficam na mesma instância, com
   separação por projeto, ou são ambientes distintos?
4. **Integração SAP** — fora de escopo por ora, por instrução do cliente.

---

## 5. Requisitos não funcionais

- **Auditoria**: rastreabilidade das ações na plataforma (proposta, Mês 6). Como
  toca segurança, o log de eventos sensíveis (login, mudança de permissão,
  exclusão de curso) deve nascer com o MVP, mesmo sem a tela de auditoria.
- **Exportação**: relatórios em PDF e Excel.
- **Responsividade**: mobile e desktop.
- **Desempenho**: orçamento medido a cada build (`npm run perf`).
- **Acessibilidade**: WCAG AA verificado por token (`npm run test:a11y`).
- **Sobreposição de ambientes**: a plataforma atual permanece ativa por 3 meses
  em paralelo. Implica **importação de dados** da base atual — que a proposta
  descreve como um backup SQL bruto. Não há tarefa para isso ainda; ver §6.

---

## 6. Lacunas de escopo que precisam de decisão

Estes itens estão prometidos na proposta e **não têm tarefa nem estimativa** no
estado atual do projeto. Não é possível fechar o MVP sem tratá-los:

1. **Backoffice de administração** — sem ele, não existe forma de cadastrar
   curso, módulo, aula ou material. É pré-requisito de tudo no Mês 3.
2. **Certificados em PDF** — geração, template, verificação de autenticidade.
3. **Relatórios exportáveis** (PDF/Excel) e dashboard de indicadores.
4. **IA integrada** — assistente do aluno e insights do admin. Definir provedor;
   atenção especial ao fato de que enviar conteúdo corporativo a uma API de
   terceiro reintroduz exatamente a dependência que o projeto quer eliminar.
5. **Importação da base atual — origem a confirmar.** Há indício de que o
   backup da Brevo venha de SQL Server, mas isso ainda não está confirmado. Não é carga de dados, é
   migração entre bancos: mapa de tipos (`datetime2`, `uniqueidentifier`,
   `nvarchar`, `bit`), collation e acentuação, sequências, e datas sem fuso
   declarado. O script de carga precisa ser idempotente e **relatar linhas
   rejeitadas** — importação silenciosa que perde registro é pior que
   importação que falha. Falta o arquivo para inspecionar o esquema.
6. **SCORM** — se entrar, muda o modelo de conteúdo; não é só um tipo de upload.

---

## 7. Modelo de dados (consequência dos perfis)

Mudanças que o RBAC impõe e que já estão refletidas em `src/lib/`:

- `User` ganha `role: "admin" | "instructor" | "learner"`.
- `Course` ganha `authorId` (o Instructor que o criou) e `status`
  (`draft` | `published`) — sem isso não há o que "editar antes de publicar".
- `Enrollment` liga aluno e curso; passa a registrar quem matriculou.
- `Comment` ganha autor, aula, resposta-pai e um marcador de destaque
  **derivado** do papel do autor, nunca enviado pelo cliente.

---

## 8. Regra de segurança que atravessa tudo

A proposta vende governança. Em código isso significa:

- **Toda autorização acontece no servidor.** Papel, autoria e matrícula nunca
  vêm do cliente.
- **A tag Professor é derivada**, não declarada: o servidor decide se destaca a
  resposta olhando papel + autoria do curso. Se fosse um campo do payload,
  qualquer aluno se passaria por professor.
- **Progresso é validado**: o cliente não pode declarar conclusão.
- **Exclusão de curso por Instructor exige autoria**; por Admin, não. Este é o
  teste de IDOR mais óbvio da plataforma e está coberto.

---

<sub>**NerdResolve LMS** · Documentação de produto · © 2026 Matheus Mariath (mariathdev) — NerdResolve.<br>Uso comercial requer licença: ver [LICENSE.md](../LICENSE.md).</sub>
