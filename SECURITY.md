# Política de segurança

## Relatar uma vulnerabilidade

**Não abra issue pública.** Use
[Security → Report a vulnerability](https://github.com/mariathdev/nerdlms/security/advisories/new),
que cria um canal privado entre você e quem mantém o projeto.

Se preferir e-mail: **contact@nerdresolve.com**.

Ajuda muito incluir: o que a falha permite fazer, os passos para chegar lá, a
versão em que você viu, e — se souber — qual arquivo está envolvido.

Retorno em até 5 dias úteis. Correção conforme a gravidade: dias para o que
permite acesso a dado de outro cliente ou execução de código, semanas para o
resto. Você é creditado no aviso, a menos que peça o contrário.

## Versões com suporte

| Versão | Suporte |
| ------ | ------- |
| `main` | sim     |
| última release menor | sim |
| anteriores | não |

## Superfícies que merecem atenção

Um relato aqui vale mais que em outros lugares:

- **Isolamento entre clientes.** A plataforma é multi-tenant. Toda consulta
  filtra por `tenant_id`, e há teste automatizado (`query-isolation.test.ts`)
  cobrindo isso. Um caminho que devolva dado de outro cliente é a falha mais
  grave possível aqui.
- **Autorização por papel.** Aluno, instrutor, gestor e administrador veem
  coisas diferentes. Rota que não verifica papel é defeito de segurança, não
  de interface.
- **Gabarito de prova.** As respostas certas não podem sair para quem responde
  antes de o resultado existir (`no-answer-leak.test.ts`).
- **Upload.** SCORM, H5P e vídeo são ZIPs enviados por usuário. Zip slip,
  ZIP bomb e conteúdo executável são vetores reais.
- **SSO / SAML / LDAP.** Verificação de assinatura, validação de emissor,
  reuso de asserção.
- **Certificado e badge.** O código de verificação não pode ser adivinhável nem
  permitir enumerar quem concluiu o quê.

## O que o projeto já faz

- Contêineres sem root, sistema de arquivos somente-leitura, sem capacidades
  extras, e sem porta de banco publicada (`infra/docker-compose.yml`)
- Papel de aplicação no Postgres sem permissão de DDL, separado do dono do
  schema (migração `002`)
- Auditoria em tabela somente-inserção, com gatilho que recusa UPDATE e DELETE
- Segredos cifrados em repouso (`backend/src/crypto/secret-box.ts`)
- CodeQL, `npm audit` e Gitleaks em cada PR e semanalmente
  (`.github/workflows/seguranca.yml`)

## Ao implantar

Nenhum `.env` é versionado. Copie o exemplo, gere segredos próprios, e não
reaproveite os de outro ambiente:

```bash
cp infra/.env.example infra/.env
openssl rand -hex 32    # um valor NOVO para cada segredo
```

O seed de homologação (`infra/db/seeds/hml.sql`) usa senhas derivadas do login
e **recusa rodar** sem `-v allow_seed=yes`. Nunca aponte-o para produção.
