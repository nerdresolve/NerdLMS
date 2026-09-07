# Implantação — `lms.exemplo.com`

> **O domínio ainda não é o da Exemplo S.A..** `lms.exemplo.com` é o
> endereço de demonstração em uso, e o nome vem do cliente para quem o produto
> foi especificado antes desta implantação. O endereço sai de `SITE_ADDRESS` no
> `infra/.env`: não há domínio fixo em código.
>
> **O certificado imprime o domínio declarado no banco.** O endereço de
> conferência sai da coluna `domain` da tabela `tenants`, e não de código.
> Vazia, o rodapé imprime "Confira o código com a área de treinamento" em vez
> de um endereço — antes ele trazia `lms.exemplo.com/validar` escrito à
> mão, e quem tentasse conferir batia numa porta fechada.
>
> Para que o certificado leve o endereço, declare o domínio depois que o DNS
> apontar para esta instalação:
>
> ```sql
> UPDATE tenants SET domain = 'lms.exemplo.com.br' WHERE slug = 'exemplo';
> ```

A publicação é por **Cloudflare Tunnel**: o container `cloudflared` abre a
conexão de dentro para fora, e o TLS público termina na borda da Cloudflare.
Isso derruba três exigências que um deploy convencional teria — IP público,
portas abertas na entrada e certificado próprio. A máquina só precisa alcançar
a internet.

## O que eu preciso de você

| # | Item | Por quê |
|---|---|---|
| 1 | **Uma máquina com Docker e Docker Compose** | 2 vCPU / 4 GB atende a operação-base de 100 usuários da proposta. Linux, macOS ou Windows |
| 2 | **Saída para a internet** | O `cloudflared` disca para a Cloudflare por QUIC (UDP 7844). Nada precisa entrar |
| 3 | **O token do túnel** | Credencial que autoriza aquela máquina a servir o domínio |

Não precisa de IP fixo, porta liberada, nem nada no firewall de entrada.

## Migrar para outra máquina

Duas coisas, e só a segunda não vem no clone.

### 1. Clonar

```bash
git clone https://github.com/NerdResolve-Energy/nerdlms.git
cd nerdlms
npm install
```

### 2. Os dois arquivos que o clone NÃO traz

Nenhum dos dois está no repositório. Os dois precisam vir por um canal seguro,
da máquina atual ou do cofre de senhas.

**`infra/.env`** carrega domínio, senha do banco, chave de sessão, chaves do
storage e credencial de SMTP. Sem ele, `npm run up` para em
`defina no .env` — falha clara, e é o comportamento desejado.

> O comentário no `.gitignore` diz que este arquivo "É VERSIONADO por decisão
> explícita", mas o padrão `.env` logo abaixo o exclui, e ele **não está** no
> repositório. Os dois lados da contradição são defensáveis, e a escolha é de
> quem opera: versionar troca segurança por um deploy de um `git clone` só.
> Enquanto ninguém decidir, vale o que acontece hoje, que é o mais seguro
> — o arquivo fica fora.

**`infra/.env.tunnel`** guarda o `TUNNEL_TOKEN`, que dá controle do túnel:

```bash
cp infra/.env.tunnel.example infra/.env.tunnel
```

Cole o `TUNNEL_TOKEN` do túnel **`nerdlms`**: Cloudflare Zero Trust →
Networks → Tunnels → `nerdlms` → Configure. É a cadeia depois de `--token`,
começando com `eyJ`. (Na máquina atual o arquivo já existe: copiá-lo por um
canal seguro evita ir ao painel.)

Sem ele, `npm run publish` para com `couldn't find env file` — falha clara, não
silenciosa.

### 3. Subir

```bash
npm run publish        # constrói a imagem, sobe tudo e conecta o túnel
npm run migrate:tunnel # cria o schema
npm run seed:tunnel    # dados de homologação (opcional — ver abaixo)
```

Confirme que o túnel registrou as conexões:

```bash
npm run publish:logs
# Registered tunnel connection connIndex=0 … protocol=quic
```

Quatro conexões é o normal — a Cloudflare abre uma réplica com redundância.

### 4. Desligar a máquina antiga

**Faça isto depois de a nova estar servindo.** Duas réplicas do mesmo túnel
fazem a Cloudflare dividir as requisições entre elas, e metade cairia numa
máquina cujo banco tem outros dados:

```bash
npm run publish:down   # na máquina antiga
```

### Como conferir que está no ar

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://lms.exemplo.com/api/health
```

Precisa responder `200`. Se der timeout, teste de outra rede antes de suspeitar
do servidor: redes corporativas costumam bloquear o domínio, e daqui o acesso
falha enquanto de dentro de um container responde em 160 ms.

## Dados de homologação

```bash
npm run seed:tunnel
```

O seed cria contas com senha derivada do login (`admin.mock` / `adminmock`) —
ver `HOMOLOGACAO.md`. **Qualquer pessoa com o link entra como administrador**, e
as credenciais estão neste repositório: adequado para demonstrar, inaceitável
com usuários reais.

Para produção de verdade, pule o seed e crie o primeiro administrador direto no
banco:

```sql
-- Gere o hash com: node -e "import('@nerdlms/core/auth/password.ts').then(m=>console.log(m.hashPassword('SUA_SENHA')))"
INSERT INTO users (email, full_name, password_hash, role, status)
VALUES ('voce@empresa.com.br', 'Seu Nome', '<hash>', 'admin', 'active');
```

## Se um dia sair do túnel

O `SITE_ADDRESS` do `.env.tunnel` leva `http://` na frente de propósito: atrás
do túnel o TLS termina na Cloudflare e a requisição chega ao Caddy em HTTP
interno. O prefixo faz o Caddy servir sem tentar a Let's Encrypt — o desafio
ACME nunca chegaria até ele, e sem isso ele reiteraria o pedido para sempre.

Publicando por IP público em vez de túnel, tire o `http://`, aponte o DNS para o
IP em **DNS only** (nuvem cinza) e abra as portas 80 e 443. Cloudflare em
*Proxied* com SSL *Flexible* gera laço de redirecionamento; se quiser proxy,
use **Full (strict)**.

## Antes de chamar de produção

Quatro pendências registradas, nenhuma delas bloqueia a subida, mas todas
importam antes de usuários reais entrarem:

1. **Provar o SMTP.** O `.env` já vem com `MAIL_TRANSPORT=smtp` e a caixa
   `contato@mariath.dev` na Hostinger, mas o envio nunca rodou de um servidor
   de verdade. Duas verificações, na ordem:

   ```bash
   openssl s_client -connect smtp.hostinger.com:465 -brief
   ```

   Precisa responder `CONNECTION ESTABLISHED`. Provedor de nuvem costuma
   bloquear saída SMTP por padrão para conter spam, e o bloqueio, visto do log
   da aplicação, é indistinguível de senha errada. Se travar, abre-se por
   chamado. (Da rede de desenvolvimento a Hostinger derruba a conexão enquanto
   o Gmail na mesma porta responde — filtro de reputação de origem, não
   defeito de configuração.)

   Depois, um pedido real de recuperação: em `npm run publish:logs` **não**
   deve aparecer o bloco `e-mail não enviado`. Se aparecer `Falha ao enviar
   e-mail por SMTP`, o motivo está logo abaixo, no mesmo log.
2. **O domínio do certificado.** `tenants.domain` está vazio, então o PDF sai
   sem endereço de conferência — correto, e ainda assim incompleto: quem
   recebe o documento fica dependendo da área de treinamento para validar o
   código. Depois que o DNS apontar para cá, rode o `UPDATE` do começo deste
   documento e emita um certificado de teste para ver o endereço no rodapé.
3. **ISSUE-028** — a CSP usa `'unsafe-inline'` em `script-src`. Nenhuma origem
   externa executa script, mas a proteção contra inline injetado está aberta.
4. **Rotacionar os segredos.** O `infra/.env` da máquina atual foi escrito para
   demonstração e circulou por canais de desenvolvimento. Antes de qualquer
   usuário real entrar, gere valores novos:

   ```bash
   openssl rand -base64 36    # POSTGRES_PASSWORD, APP_DB_PASSWORD,
                              # SESSION_SECRET, STORAGE_SECRET_KEY
   ```

   `DATABASE_URL` repete a `APP_DB_PASSWORD` — trocar uma sem a outra faz o
   banco subir e a aplicação não conectar. Trocar o `SESSION_SECRET` derruba
   todas as sessões abertas, o que é o comportamento desejado numa rotação.

## Levar os dados junto

O clone traz o código e a configuração, **não o banco**. Ele vive no volume
`db-data` do Docker, que fica na máquina. Migrando com dados que importam:

```bash
# na máquina antiga
npm run compose:tunnel -- exec -T db \
  pg_dump -U lms_migrator nerdlms | gzip > nerdlms.sql.gz

# na nova, depois do migrate
gunzip -c nerdlms.sql.gz | npm run compose:tunnel -- exec -T db \
  psql -U lms_migrator -d nerdlms
```

Se forem só dados de homologação, é mais simples rodar `npm run seed` na nova e
descartar os antigos — o seed é reaplicável e reproduz o mesmo estado.

Os arquivos de mídia ficam no volume `storage-data` e **não entram no
`pg_dump`**. Ele guarda os vídeos das aulas: hoje são 522 MB, e sem eles o
banco restaurado tem os cursos com aulas que não abrem. Migrando de máquina,
ou o volume vai junto, ou `node infra/tools/upload-cursos.mjs` roda de novo a
partir do material de origem.

## Backup

Não está configurado, e a proposta pede que RPO e RTO sejam definidos antes da
produção (seção 9). O mínimo, enquanto a política não existe, é o mesmo
`pg_dump` acima em rotina — os dois volumes (`db-data` e `storage-data`)
precisam entrar na cópia.

## Atualizar depois

```bash
git pull
npm run publish          # o --build está embutido: reconstrói e reinicia
npm run migrate:tunnel   # se houver migração nova
```

`publish` carrega `--build` justamente porque `docker compose up -d` sozinho
reaproveita a imagem existente — o código novo não entraria e o servidor
seguiria servindo a versão anterior, sem erro nenhum para denunciar.

O `git pull` **não** traz mudança de `infra/.env`: o arquivo não está no
repositório. Variável nova aparece primeiro no `infra/.env.example`, e cabe a
quem atualiza o servidor copiá-la para o `.env` de lá. Se esquecer, o Compose
para no `defina no .env` da variável que falta, em vez de subir com o valor
padrão errado.

As migrações são reaplicáveis: rodar de novo sobre um banco já migrado não
quebra nem duplica.
