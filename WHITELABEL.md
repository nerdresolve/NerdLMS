# NerdResolve LMS — implantar para um cliente

Como colocar um cliente novo na plataforma: criar o tenant, apontar o domínio,
aplicar a identidade visual e decidir o que fica ligado.

> Os exemplos usam **NerdResolve** como cliente — é a primeira implantação em
> produção e serve de referência. Troque pelo nome do seu cliente.

Um tenant é o recorte de isolamento do produto. Cada cliente tem os próprios
cursos, pessoas, notas e configuração, e nada atravessa de um para outro — a
separação é por `tenant_id` em 38 tabelas, e há um teste que falha o build
quando alguém escreve uma consulta sem esse recorte
(`apps/backend/src/tenancy/query-isolation.test.ts`).

---

## Versão curta

Se o tenant já existe e o domínio já aponta, personalizar é isto — tudo em
**Administração → Plataforma**, sem tocar em código:

| Passo | O que fazer | Onde |
|---|---|---|
| **1. Logo** | Suba a versão clara, a escura e o favicon | Identidade visual |
| **2. Cor** | Cole o hexadecimal da marca. A paleta inteira sai dele | Identidade visual |
| **3. Funcionalidades** | Ligue e desligue as 19 chaves | Funcionalidades |
| **4. Acesso** | Cole as credenciais do Google, Microsoft, LDAP ou SAML | Acesso |

Pronto. O resto deste documento é o caminho completo — criar o tenant, apontar
o domínio, e o que conferir antes de entregar.

> **Enquanto o cliente não subir a marca dele, a plataforma mostra a do
> produto** (NerdResolve LMS). Nenhum cliente vê a marca de outro.

---

## O que você precisa antes de começar

| Item | Onde consegue |
|---|---|
| Domínio ou subdomínio do cliente | Com o cliente. Ex.: `treinamento.acme.com.br` |
| Cor da marca em hexadecimal | Manual de marca do cliente. Uma cor só |
| Logo em fundo claro e escuro | PNG ou SVG, fundo transparente |
| Favicon | `.ico` ou PNG 32×32 |
| E-mail remetente | Uma caixa que o cliente controle |
| Nome da unidade organizacional | Como o cliente chama: "Regional", "Filial", "Concessionária" |
| Acesso ao banco de produção | `docker exec` no container do Postgres |
| **Se usa Google ou Microsoft:** ID e chave do cliente | Console do Google ou portal do Entra. Na Microsoft, também o ID do diretório |
| **Se usa Active Directory:** servidor e domínio | Com quem administra a rede. A porta é 636 |
| **Se usa ADFS, Okta ou similar:** metadados do IdP | Entity ID, URL de SSO e certificado, dos metadados do provedor |

Não existe tela para criar tenant. É SQL, deliberadamente: criar um cliente é
uma operação de implantação, não de administração do dia a dia, e uma tela para
isso conviveria com o risco de alguém criá-lo por engano.

---

## 1. Criar o tenant

Uma instrução. `slug` e `domain` são únicos.

```sql
INSERT INTO tenants (slug, name, domain, unit_label, brand_color,
                     mail_from_name, mail_from_email)
VALUES (
  'acme',                          -- slug: minúsculo, sem espaço, não muda depois
  'ACME Saneamento',               -- nome que aparece nas telas e nos e-mails
  'treinamento.acme.com.br',       -- domínio SEM https:// e SEM barra final
  'Regional',                      -- como o cliente chama a unidade dele
  '#B8860B',                       -- cor da marca, hexadecimal de 6 dígitos
  'ACME Treinamento',              -- nome que assina os e-mails
  'treinamento@acme.com.br'        -- endereço remetente
)
RETURNING id;
```

Guarde o `id` que volta — os próximos passos usam.

### O que cada campo faz

**`slug`** — identificador interno. Aparece em log e no `NERDRESOLVE_DEFAULT_TENANT`.
Trocar depois quebra referências; escolha uma vez.

**`domain`** — é por ele que a plataforma sabe de quem é a visita. Alguém que
chega por `treinamento.acme.com.br` vê a ACME; por outro domínio, vê outro
cliente. A resolução está em `apps/frontend/src/lib/tenant-request.ts`, e usa
`x-forwarded-host` antes de `host` — atrás do proxy, `host` chega como o nome
interno do container.

Sem domínio cadastrado, a requisição cai no tenant padrão
(`NERDRESOLVE_DEFAULT_TENANT`, ou `nerdlms`). Isso é o que segura uma instalação de
cliente único; com dois clientes, cada um **precisa** do próprio domínio, ou o
segundo nunca é alcançado.

**`unit_label`** — o produto fala "unidade" o tempo todo: filtro de relatório,
cadastro de pessoa, desempenho por área. O rótulo é do cliente. A pluralização
é automática (`packages/core/src/tenancy/unit-label.ts`), então informe no
singular.

**`brand_color`** — uma cor, e o resto é derivado. Explicado no passo 3.

---

## 2. Criar o primeiro administrador

O tenant nasce sem ninguém. Sem este passo, ninguém entra.

```sql
INSERT INTO users (tenant_id, email, full_name, role, status)
VALUES (
  '<id-do-tenant>',
  'nome@acme.com.br',
  'Nome Completo',
  'admin',
  'pending'
);
```

`password_hash` fica nulo de propósito: quem escolhe a senha é a pessoa, no
primeiro acesso. Um administrador que digita a senha de outro passa a saber a
senha de outro.

O status `pending` faz a conta existir sem poder entrar até a senha ser
definida. A pessoa recebe o convite por e-mail se o SMTP estiver configurado
(passo 6); sem SMTP, mande você mesmo o link de definição de senha.

A partir daqui, o resto se resolve pela interface — este administrador convida
os demais em **Administração → Usuários**, ou importa uma planilha.

---

## 3. Identidade visual

### A cor

Você informa **uma** cor e o produto deriva a paleta inteira: hover, active,
superfícies, gradiente, ondas da marca. A lógica está em
`packages/core/src/tenancy/branding.ts`.

Com `#B8860B`, a paleta sai assim:

```
--brand:#B8860B
--brand-hover:#c19528
--brand-active:#c8a141
--brand-deep:#533c05
--surface-brand-subtle:…
--text-on-brand:…
```

**O contraste é ajustado sozinho.** A cor do texto sobre a marca é escolhida
para passar em WCAG AA (4.5:1) — com o dourado acima, o resultado é 5.79:1. Uma
cor clara demais recebe texto escuro; uma escura recebe texto claro. Você não
precisa calcular nada, e não consegue produzir uma combinação ilegível pelo
campo de cor.

**Cor inválida cai no padrão.** `paletteToCss` só aceita hexadecimal de seis
dígitos. Qualquer outra coisa — nome de cor, `rgb()`, texto solto — devolve
vazio e a plataforma usa a cor padrão. Não quebra a tela, mas também não aplica
a marca; se a cor não pegou, é aqui que olhar.

### Logos e favicon

Três arquivos, referenciados por URL:

| Coluna | Uso | Formato |
|---|---|---|
| `logo_light_url` | Sobre fundo claro | PNG/SVG, fundo transparente |
| `logo_dark_url` | Sobre fundo escuro (menu lateral) | PNG/SVG, versão clara da logo |
| `favicon_url` | Aba do navegador | `.ico` ou PNG 32×32 |

As duas logos são necessárias porque o menu lateral é escuro e o corpo é claro.
Uma logo só, escura, some no menu.

Duas formas de hospedar:

**Pelo storage da plataforma** — envie ao bucket MinIO e use o caminho público:

```sql
UPDATE tenants
   SET logo_light_url = '/lms-media/brand/acme-light.png',
       logo_dark_url  = '/lms-media/brand/acme-dark.png',
       favicon_url    = '/lms-media/brand/acme.ico'
 WHERE slug = 'acme';
```

**Por URL externa** — se o cliente já hospeda, use a URL absoluta. Precisa ser
HTTPS: um `http://` numa página HTTPS é bloqueado pelo navegador e a logo
simplesmente não aparece.

### Pela interface

Depois do primeiro acesso, tudo isso é editável em **Administração →
Plataforma**, sem SQL. Use o SQL para a implantação inicial e deixe os ajustes
com o cliente.

---

## 4. Apontar o domínio

### DNS

Aponte o domínio do cliente para o servidor. Registro `A` para o IP, ou `CNAME`
se estiver atrás de Cloudflare.

### Certificado

O Caddy resolve HTTPS sozinho, via Let's Encrypt. O que ele precisa está em
`infra/.env`:

```
SITE_ADDRESS=treinamento.acme.com.br
ACME_EMAIL=infra@suaempresa.com.br
```

`ACME_EMAIL` recebe o aviso de certificado prestes a expirar. Precisa ser um
endereço válido — `email` sem argumento não é "sem e-mail", é erro de sintaxe, e
o Caddy recusa o arquivo inteiro e reinicia em laço.

### Vários domínios no mesmo servidor

O bloco de site do Caddy é `{$SITE_ADDRESS}` — um endereço por vez. Para servir
vários clientes do mesmo servidor, liste os domínios separados por espaço:

```
SITE_ADDRESS="treinamento.acme.com.br ead.outrocliente.com.br"
```

O Caddy trata um bloco com vários endereços como o mesmo site, emite certificado
para cada um, e a aplicação resolve o tenant pelo `Host` da requisição — um
servidor, vários clientes, nenhum vê o outro.

Confirme depois de subir, porque um erro aqui derruba o proxy em laço:

```bash
npm run compose:prod -- logs proxy | tail -20
```

### Atrás do Cloudflare Tunnel

Se estiver publicando pelo túnel, o TLS público termina na Cloudflare e o túnel
entrega em HTTP interno. Aí `SITE_ADDRESS` leva o esquema explícito:

```
SITE_ADDRESS=http://nerdlms
```

Sem o `http://`, o Caddy tenta emitir certificado para um domínio cujo desafio
ACME nunca chega até ele, e repete para sempre.

Depois de mexer no `.env`, o proxy precisa reler:

```bash
npm run compose:prod -- up -d proxy
```

---

## 5. Escolher o que fica ligado

São 19 funcionalidades desligáveis, em árvore. O catálogo em
`packages/core/src/tenancy/features.ts` define o padrão de cada uma — e o padrão
não é o mesmo para todas: o que o produto já fazia nasce ligado, e o que impõe
uma trava nasce desligado.

```
comentarios
├── comentarios.respostas
└── comentarios.upvotes
forum
├── forum.anexos
└── forum.denuncias
notificacoes
└── notificacoes.email
gamificacao
├── gamificacao.distintivos
└── gamificacao.loja
rigor
├── rigor.video
└── rigor.leitura
trilhas, agenda, certificados, favoritos, busca
```

**A família `rigor` nasce DESLIGADA**, ao contrário das demais. São travas, e
travas atrapalham quem não precisa delas — um curso de integração não tem o
mesmo peso que um de segurança em espaço confinado.

**A hierarquia manda.** Desligar `comentarios` desliga respostas e upvotes
junto, independentemente do que estiver marcado neles. É o que evita o estado
incoerente de "upvote ligado num produto sem comentário".

Faça pela interface — **Administração → Plataforma** — que é onde a árvore
aparece e o efeito de desligar um pai fica visível. Por SQL, se precisar
automatizar a implantação:

```sql
INSERT INTO tenant_features (tenant_id, feature, enabled)
VALUES
  ('<id-do-tenant>', 'gamificacao', false),
  ('<id-do-tenant>', 'forum', false)
ON CONFLICT (tenant_id, feature) DO UPDATE SET enabled = EXCLUDED.enabled;
```

A tabela guarda **só o que o cliente mudou**. Ausência de linha significa "usa o
padrão do produto", e é assim que uma funcionalidade nova entra ligada para
todos sem precisar de migração de dados.

### As travas de conclusão

Duas funcionalidades mudam o que "concluir uma aula" significa. Valem a
conversa com o cliente antes de ligar.

**`rigor.video` — travar o avanço.** Impede arrastar a barra para um trecho
ainda não assistido. Sem ela, arrastar até o fim marca a aula como vista sem
ninguém ter visto — em treinamento de segurança, isso é a diferença entre o
registro dizer a verdade e não dizer.

O que ela NÃO faz: impedir voltar. Rever é parte de estudar, e travar isso
puniria justamente quem presta atenção. Quem já assistiu até certo ponto pode
navegar livremente até lá, hoje e depois de fechar o navegador — o ponto máximo
fica gravado no progresso.

Assistir em 1,5× ou 2× continua valendo. A trava acompanha a velocidade, e só
recusa o que não pode ter sido reprodução.

**`rigor.leitura` — confirmar a leitura.** Quem clica em "concluir" antes de
metade do tempo estimado recebe a pergunta: *"O tempo estimado de leitura deste
documento é de cerca de 8 minutos. Você tem certeza de que já terminou?"*

É PERGUNTA, não trava, e a distinção é deliberada: bloquear por tempo puniria
quem lê rápido e não impediria quem quer burlar — bastaria deixar a aba aberta.
O modal faz a pessoa afirmar que leu, e é isso que ele acrescenta.

A estimativa é de 300 palavras por página e 200 palavras por minuto — leitura
atenta de material técnico. É declaradamente grosseira, e é por isso que
alimenta uma pergunta em vez de uma trava. Documento sem contagem de páginas
não gera pergunta nenhuma: o produto não inventa um tempo que não sabe medir.

**Desligar não apaga.** O conteúdo continua no banco: some das telas e volta se
alguém religar. Um cliente que desliga o fórum por seis meses não perde as
discussões.

---

## 6. E-mail

Duas camadas: o transporte (do servidor) e a identidade (do cliente).

O transporte fica no `infra/.env` e vale para a instalação inteira:

```
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.provedor.com.br
SMTP_PORT=587
SMTP_USER=…
SMTP_PASSWORD=…
SMTP_FROM=nao-responda@suaempresa.com.br
```

Com `MAIL_TRANSPORT=log`, nada é enviado — o e-mail vai para o log do
container. É o padrão em desenvolvimento e o que você quer ao testar uma
implantação sem incomodar ninguém.

A identidade é por tenant, nas colunas `mail_from_name` e `mail_from_email` que
você já preencheu no passo 1. Quem recebe vê "ACME Treinamento", não o nome da
sua empresa.

**Se o cliente usa o próprio domínio no remetente**, ele precisa autorizar seu
servidor no SPF, ou o e-mail cai em spam. É a única parte deste processo que
depende de alguém do lado do cliente mexer em DNS — encaminhe cedo.

Os textos dos e-mails também são por cliente, editáveis em **Administração →
Plataforma → Textos dos e-mails**. Sem texto próprio, vale o padrão do produto.

---

## 7. Acesso pelo sistema da empresa (SSO)

Opcional, e quase sempre pedido. Empresa de porte não quer mais uma senha para
gerenciar: quer que o desligamento no diretório dela feche o acesso aqui, no
mesmo dia.

Google e Microsoft **já vêm configurados** no produto — os endereços deles são
públicos e iguais para todo mundo. O que você preenche é só o que é do cliente.

Tudo acontece em **Administração → Acesso** — as quatro formas ficam na mesma
tela, uma seção para cada.

### Qual dos três

O produto oferece três formas de entrar pelo sistema da empresa. A escolha não
é de gosto — depende do que o cliente já tem:

| Se o cliente usa | Escolha | Por quê |
|---|---|---|
| Google Workspace ou Microsoft 365 | **OIDC** | Já vem configurado; ele cola duas chaves |
| Active Directory na rede dele | **LDAP** | O diretório já existe e já tem todo mundo |
| ADFS, Okta, OneLogin, Shibboleth | **SAML 2.0** | É o que essas ferramentas falam |
| Okta ou Auth0 modernos | **OIDC genérico** ou SAML | Os dois funcionam; OIDC é menos configuração |

Dá para ligar mais de um ao mesmo tempo. Quem tem Active Directory e Google
costuma querer os dois: o AD para quem está na rede, o Google para quem está
em campo.

### LDAP e Active Directory

O que muda por cliente é o servidor e o domínio. O formato do identificador —
que difere entre AD e OpenLDAP — vem do produto.

| Campo | Active Directory | OpenLDAP |
|---|---|---|
| Servidor | `dc.empresa.com.br` | `ldap.empresa.com.br` |
| Porta | 636 | 636 |
| Domínio | `empresa.com.br` | — |
| Base | — | `dc=empresa,dc=com,dc=br` |

**A porta 636 não é opcional.** É LDAP sobre TLS, e o produto não oferece a
porta 389: a autenticação manda a senha do diretório corporativo, e sem TLS ela
atravessa a rede legível.

**Certificado da própria empresa.** Diretório corporativo quase nunca usa
certificado de autoridade pública. Se a conexão falhar com erro de certificado,
marque a opção correspondente — é uma escolha consciente, e fica registrada.

O que a pessoa digita é o nome de login dela, não o DN completo. O produto
monta o resto.

### SAML 2.0

Aqui a troca é de metadados, e é mútua. Do provedor você precisa de três
valores; para o provedor você entrega dois.

**O que trazer do provedor:**

| Campo | Onde encontrar |
|---|---|
| Entity ID | Nos metadados do IdP, como `entityID` |
| URL de SSO | O endereço `HTTP-Redirect` de SingleSignOnService |
| Certificado | O bloco `X509Certificate` dos metadados, ou o arquivo `.cer` |

**O que entregar ao provedor:**

| Campo | Valor |
|---|---|
| Entity ID (SP) | O que você definir na tela — normalmente a URL da plataforma |
| URL de retorno (ACS) | `https://treinamento.acme.com.br/api/saml/retorno` |

**Cadastre o certificado novo ANTES de o provedor rotacionar.** O campo aceita
vários, e é para isso: durante a troca, o provedor já assina com a nova chave
enquanto o cliente ainda tem a velha. Com os dois cadastrados, ninguém percebe
a rotação; com um só, o login para até alguém atualizar.

**O provedor precisa assinar com SHA-256.** Muitos ainda vêm de fábrica com
SHA-1, que é recusado — colisão de SHA-1 é demonstrada desde 2017, e aceitá-lo
tornaria a validação decorativa. A mensagem de erro diz o que configurar.

**Asserção não solicitada não entra.** Alguns provedores oferecem um botão que
manda a asserção sem a plataforma ter pedido. O produto recusa: sem um pedido
nosso, não há como saber que a pessoa quis entrar aqui.

### O passo que mais trava

A primeira coisa da tela é a **URL de retorno**, com botão de copiar. Cadastre
esse endereço no provedor **exatamente como está lá**:

```
https://treinamento.acme.com.br/api/sso/retorno
```

O Google e a Microsoft comparam a string inteira e recusam por uma barra a
mais, com uma mensagem que não diz qual era o endereço esperado. Se o login
falhar logo no começo, é quase sempre isto.

### Google

No Google Cloud Console, em **APIs e Serviços → Credenciais**, crie um **ID do
cliente OAuth** do tipo aplicativo da Web. Cole a URL de retorno lá, e traga de
volta duas coisas:

| Campo na tela | De onde vem |
|---|---|
| ID do cliente | termina em `.apps.googleusercontent.com` |
| Chave secreta | aparece uma vez, na criação |

### Microsoft

No portal do **Entra ID**, em **Registros de aplicativo**, registre um
aplicativo. São três valores:

| Campo na tela | De onde vem |
|---|---|
| ID do diretório (locatário) | visão geral do aplicativo |
| ID do cliente | visão geral do aplicativo |
| Chave secreta | **Certificados e segredos** |

O ID do diretório é obrigatório e não tem atalho. Existe um valor `common` que
a Microsoft aceita, e ele deixaria **qualquer conta Microsoft do mundo** entrar
— inclusive pessoais. Numa plataforma corporativa isso é uma porta aberta, e
por isso o produto não oferece essa opção.

### Outro provedor

Okta, Keycloak, Auth0 e afins entram como **OpenID Connect**. Aí você preenche
quatro endereços à mão, todos disponíveis no documento de descoberta do
provedor, geralmente em:

```
https://provedor-do-cliente.com/.well-known/openid-configuration
```

### As três decisões que importam

**Domínios aceitos.** Preencha. Em branco, o produto aceita qualquer e-mail que
o provedor confirmar — e num cliente que usa o Google como provedor, isso
inclui qualquer `@gmail.com` do mundo. Com `acme.com.br` preenchido, quem está
fora é recusado.

**Criar conta no primeiro acesso.** Vem desligada. Ligada, qualquer pessoa do
diretório da empresa vira usuária ao entrar pela primeira vez, com o papel que
você escolher ao lado. Boa parte dos clientes quer exatamente isso; nenhum quer
descobrir depois que aconteceu sem ter pedido.

**Manter o login por senha.** Deixe ligado até testar. Desligar exige que todos
entrem pelo provedor — e se a configuração estiver errada, ninguém entra, nem
você. A tela pede confirmação antes de deixar você desmarcar.

### Como uma pessoa é reconhecida

Pela ordem:

1. **Já entrou por aqui antes** — o vínculo existe, entra direto.
2. **Já tinha conta com o mesmo e-mail** — o vínculo é criado no primeiro
   acesso e ela entra na conta que já era dela.
3. **Não tem conta** — cria, se você ligou a opção; senão, recusa com um aviso
   para procurar o administrador.

O vínculo é gravado pelo identificador do provedor, **não pelo e-mail**. É
importante: quem casa e troca de sobrenome recebe outro endereço e continua a
mesma pessoa. E um endereço desligado pode ser reatribuído a outro funcionário
— seguir o e-mail entregaria a conta antiga ao novo dono do endereço.

**Conta desativada não entra**, mesmo com vínculo. É o acesso que uma empresa
mais quer cortar no dia de um desligamento.

### Testando

Ligue o provedor, abra a tela de login numa janela anônima e clique no botão. O
que deve acontecer:

- você vai para o provedor;
- volta para a plataforma já logado;
- em **Administração → Auditoria** aparece um registro `Entrou` e, no primeiro
  acesso, um `Vinculou conta ao provedor`.

Se der erro, a mensagem volta na própria tela de login. As mais comuns:

| Mensagem | O que verificar |
|---|---|
| O provedor de identidade recusou a autenticação | chave secreta errada ou vencida; URL de retorno não cadastrada |
| Este e-mail não pertence a um domínio autorizado | o domínio da pessoa não está na lista |
| Você não tem conta nesta plataforma | conta não existe e a criação automática está desligada |
| O provedor está configurado pela metade | falta o ID do diretório (Microsoft) ou um dos endereços (genérico) |

---

## 8. Conteúdo e sistemas de fora

Nada aqui é obrigatório para entregar um cliente. Está neste documento porque a
pergunta aparece cedo na implantação — quase sempre na forma "temos os
treinamentos no sistema antigo, dá para aproveitar?".

### Trazer o que o cliente já tem

| O que ele tem | O que fazer |
|---|---|
| Pacote SCORM 1.2 ou 2004 | Envie o `.zip` ao criar a aula, em **Instrutor → Meus cursos → (o curso)**. O tipo, o título e a nota de corte saem do próprio pacote |
| Pacote H5P (`.h5p`) | Importa o conteúdo — perguntas, gabarito e o instante de cada uma no vídeo. Ver a ressalva abaixo |
| Banco de questões de outro LMS | Exporte em QTI e importe na tela do curso, em **Instrutor → Meus cursos → (o curso)**. Aceita `.xml` (QTI 2.x e 3.0) e `.csv` |
| Planilha de pessoas | **Administração → Usuários → Importar**. Confere antes de gravar |
| Catálogo de cursos em planilha | **Instrutor → Meus cursos**, no bloco de importação |

**Sobre o H5P.** O que atravessa é o CONTEÚDO, não a biblioteca: o código de
renderização do H5P é GPL, e a plataforma não o distribui. As perguntas, o
gabarito, o feedback e o instante de cada pergunta no vídeo chegam prontos — o
trabalho que ninguém quer refazer à mão. A aparência passa a ser a do player da
plataforma.

Três tipos têm equivalente: vídeo interativo, imagem com pontos e cartões. Os
demais são recusados com o nome do tipo na mensagem, para quem exportou saber o
que ficou de fora.

**A mídia é pedida na importação.** O pacote referencia um arquivo interno ou
um link do YouTube, e nenhum dos dois é a mídia da plataforma — informe o
endereço do vídeo ou da imagem ao enviar o `.h5p`.

**Sobre o SCORM.** O `.zip` é o único arquivo que passa pelo servidor — os
demais vão direto do navegador ao storage. Um pacote precisa ser descompactado,
e a URL assinada resolveria o envio sem resolver o que vem depois. O limite é
60 MB; acima disso, quase sempre há vídeo embutido no pacote, que renderia mais
como aula de vídeo separada.

**Quem edita o curso vê o conteúdo em pré-visualização.** O player abre e o
pacote roda igual, mas nada é registrado: o acompanhamento do SCORM pertence à
matrícula, e o instrutor não tem uma. A tela avisa. É de propósito — matricular
o instrutor no próprio curso sujaria os relatórios de conclusão.

### Ligar a plataforma a outro sistema

| Padrão | Para quê | Onde configura |
|---|---|---|
| **LTI 1.3** | Uma ferramenta de fora abre dentro do curso, já sabendo quem é o aluno, e devolve a nota | Cadastro da ferramenta, por SQL — ainda sem tela |
| **xAPI** | Um simulador, um app de campo ou outro LMS registram o que a pessoa fez | Chave de API, em Integrações |
| **cmi5** | Conteúdo externo com sessão, resultado e critério de conclusão declarado pelo autor | Cadastro da unidade, por SQL — ainda sem tela |
| **Webhooks** | Avisar outro sistema quando algo acontece aqui | **Administração → Integrações** |
| **API REST** | Ler e escrever de fora | Chave de API, com escopos |

O que estas cinco têm em comum: **a chave é por cliente**. Uma chave de API dá
acesso programático ao tenant inteiro, e vazá-la entre clientes seria o pior
vazamento possível — por isso ela é emitida na administração daquele cliente, e
aparece uma única vez.

### Levar embora

Vale conferir na entrega, porque é o que distingue uma plataforma de uma
armadilha:

- **Questões** — exportação em QTI 2.1, o formato que Moodle, Canvas e
  Blackboard leem. Botão na tela do curso, ao lado da importação.
- **Relatórios** — CSV, pelos botões do **Painel do projeto** (Progresso, Equipe) e por
  `/api/relatorios?tipo=progresso|usuarios|notas|cursos`.
- **O cliente inteiro** — backup em JSON, em **Administração → Plataforma**.
  Traz o conteúdo, as pessoas, as matrículas e as notas.

O mesmo arquivo serve para **migrar um cliente para outro**: restaure-o na
plataforma de destino e marque a confirmação. Todo o conteúdo ganha
identificadores novos e passa a pertencer ao destino; o cliente de origem não é
alterado. O que depende de algo que o backup não carrega — uma nota lançada por
ferramenta LTI, por exemplo — fica de fora, e a tela diz quantas linhas.

---

## 9. Conferir antes de entregar

Da máquina, com o domínio já apontando:

```bash
# A tela de login responde e traz a marca certa
curl -sI https://treinamento.acme.com.br/login | head -3

# O tenant foi resolvido pelo domínio (e não caiu no padrão)
curl -s https://treinamento.acme.com.br/login | grep -o "ACME Saneamento" | head -1
```

Pelo navegador, entrando com o administrador criado:

- [ ] A logo aparece no menu lateral **e** no corpo (as duas versões)
- [ ] O favicon é o do cliente
- [ ] Os botões estão na cor da marca, e o texto sobre eles é legível
- [ ] O rótulo de unidade aparece como o cliente chama, não "Unidade"
- [ ] **Administração → Plataforma** abre e mostra a configuração
- [ ] As funcionalidades desligadas realmente sumiram do menu
- [ ] Um e-mail de convite chega com o remetente certo

Se a marca não aplicou, o suspeito na ordem: cor fora do formato hexadecimal;
URL de logo em `http://` numa página HTTPS; domínio não bate com a coluna
`domain` (aí a aplicação caiu no tenant padrão e você está vendo outro cliente).

---

## Como o isolamento funciona

Vale saber para não se surpreender.

**Toda consulta declara o tenant.** As tabelas raiz têm `tenant_id`, e as
demais herdam por chave estrangeira. Há um teste que lê o código-fonte e falha o
build quando uma consulta lê tabela raiz sem recortar — foi escrito depois de a
lista de tabelas ficar desatualizada e passar a aprovar em silêncio o que devia
reprovar.

**A fronteira vem antes do papel.** Em `packages/core/src/auth/permissions.ts`,
a checagem de tenant acontece antes do bloco do administrador. Sem essa ordem, o
admin de um cliente enxergaria o dado de outro — e "acesso irrestrito" nunca
significou acesso à empresa alheia.

**O e-mail é único por cliente, não global.** A mesma pessoa pode ter conta em
dois clientes com o mesmo endereço. O login resolve pelo domínio de onde ela
chegou.

**Backup e restauração são por cliente.** Em **Administração → Plataforma →
Backup**, o arquivo sai com os registros daquele cliente. Restaurar só funciona
no mesmo cliente que gerou o arquivo: as linhas carregam os identificadores de
origem, e num cliente diferente eles já existem. Migrar conteúdo entre clientes
não está implementado, e a plataforma recusa em vez de fingir que funcionou.

---

## Antes de rodar qualquer comando: qual ambiente você está tocando

Esta é a parte que mais custa caro se passar batido.

Na mesma máquina convivem dois ambientes, e os scripts do `package.json` **não
avisam qual deles você está atingindo**:

| Comando | Arquivo de ambiente | Contêineres afetados |
|---|---|---|
| `npm run compose` | `infra/.env` + `.env.local` | depende de qual está por último |
| `npm run compose:prod` | `infra/.env` | `nerdlms-*` — **produção** |
| `npm run compose:tunnel` | `infra/.env` + `.env.tunnel` | `nerdlms-*` via túnel |

O nome dos contêineres é o que distingue de verdade:

- `nerdlms-app-1`, `nerdlms-db-1` — **produção**
- `nerdlms-local-app-1`, `nerdlms-local-db-1` — local

Confira antes, sempre:

```bash
docker ps --format '{{.Names}}'
```

Para agir explicitamente sobre o ambiente local, sem depender do script:

```bash
docker compose -p nerdlms-local -f infra/docker-compose.yml \
  --env-file infra/.env --env-file infra/.env.local up -d --build app
```

**O `psql` não aceita `-U nerdlms`.** O papel se chama `lms_migrator` (dono do
schema) ou `lms_app` (aplicação). Dentro do contêiner, o mais seguro é usar
as variáveis que já existem lá:

```bash
docker exec nerdlms-db-1 sh -c \
  'psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT slug FROM tenants;"'
```

---

## Migrações do banco

O schema é versionado em `infra/db/migrations/`, um arquivo por mudança, em
ordem numérica. Toda migração usa `IF NOT EXISTS`, então reaplicar é inofensivo
— e é assim que se descobre se um ambiente ficou para trás.

Para aplicar todas, em produção:

```bash
npm run migrate:prod
```

Cada arquivo roda numa transação própria, com `ON_ERROR_STOP=1`: um erro
interrompe naquele arquivo e não deixa meia migração aplicada.

**Faça `pg_dump` antes.** Não porque a migração seja perigosa, mas porque a
alternativa a ter o backup é descobrir que precisava dele:

```bash
docker exec nerdlms-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB' \
  > backup-$(date +%Y%m%d-%H%M).sql
```

**Uma imagem nova exige o schema dela.** Subir a aplicação sem aplicar as
migrações correspondentes derruba as telas que dependem das tabelas novas — com
erro 500, não com uma mensagem clara. A ordem é: migrar, depois subir.

Para saber em que ponto um ambiente está, procure a tabela mais recente:

```bash
docker exec nerdlms-db-1 sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB \
  -tAc \"SELECT count(*) FROM information_schema.tables
         WHERE table_name IN ('sso_providers','cmi5_units')\""
```

Resposta `2` significa que o banco está atualizado até a migração mais recente
deste documento.

---

## Quando algo dá errado

**Todos os clientes veem a mesma coisa.** O domínio não está batendo com a
coluna `domain`. Confira o que chega ao servidor:

```bash
docker exec nerdlms-app-1 sh -c 'echo $NERDRESOLVE_DEFAULT_TENANT'
docker exec nerdlms-db-1 psql -U lms_migrator -d nerdlms \
  -c "SELECT slug, domain FROM tenants;"
```

O valor de `domain` é comparado sem o esquema e sem a porta. `https://acme.com/`
não bate com nada; `acme.com` bate.

**Certificado não emite.** O Caddy precisa alcançar a porta 80 de fora para o
desafio ACME. Atrás de túnel, use `SITE_ADDRESS=http://…` como no passo 4.

```bash
npm run compose:prod -- logs proxy | tail -30
```

**A logo não carrega.** Abra o console do navegador. Bloqueio de conteúdo misto
significa `http://` numa página HTTPS. 404 no caminho `/lms-media/…` significa
que o arquivo não está no bucket.

**Funcionalidade desligada continua aparecendo.** As telas são renderizadas no
servidor com cache por requisição; force um recarregamento limpo. Se persistir,
confira que a linha entrou para o tenant certo:

```sql
SELECT t.slug, f.feature, f.enabled
  FROM tenant_features f
  JOIN tenants t ON t.id = f.tenant_id
 WHERE t.slug = 'acme';
```

---

## Checklist de implantação

```
[ ] Migrações aplicadas no banco de destino
[ ] Tenant criado (slug, nome, domínio, unit_label)
[ ] Primeiro administrador criado com status 'pending'
[ ] Cor da marca aplicada e conferida no navegador
[ ] Logo clara, logo escura e favicon no ar
[ ] DNS apontando para o servidor
[ ] SITE_ADDRESS atualizado e proxy reiniciado
[ ] Certificado emitido (https sem aviso)
[ ] Funcionalidades revisadas com o cliente
[ ] SPF autorizado, se o remetente usa o domínio do cliente
[ ] E-mail de convite recebido com o remetente certo
[ ] Administrador do cliente definiu a senha e entrou

Se o cliente usa Google ou Microsoft (OIDC):
[ ] URL de retorno cadastrada no provedor, igual à da tela
[ ] ID e chave secreta preenchidos (e o ID do diretório, na Microsoft)

Se usa Active Directory ou LDAP:
[ ] Servidor e porta 636 alcançáveis do servidor da plataforma
[ ] Domínio (AD) ou base (OpenLDAP) preenchidos
[ ] Certificado próprio? Opção marcada, se for o caso

Se usa SAML:
[ ] Entity ID, URL de SSO e certificado do provedor cadastrados
[ ] Entity ID e URL de retorno entregues a quem administra o provedor
[ ] Provedor configurado para assinar com SHA-256

Em qualquer um deles:
[ ] Domínios aceitos preenchidos
[ ] Login testado em janela anônima
[ ] Registro do acesso conferido na Auditoria

Se o cliente traz conteúdo de outro sistema:
[ ] Questões importadas e conferidas antes de aplicar
[ ] Pacotes SCORM enviados e abertos com uma conta matriculada
```

---

<sub>**NerdResolve LMS** · Documentação de produto · © 2026 Matheus Mariath (mariathdev) — NerdResolve.<br>Uso comercial requer licença: ver [LICENSE.md](LICENSE.md).</sub>
