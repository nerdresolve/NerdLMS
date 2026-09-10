# Como contribuir

Obrigado pelo interesse. Este guia é curto de propósito.

## Antes de começar

Para **defeito ou proposta**, abra uma issue primeiro. Para **dúvida**, use
[Discussions](https://github.com/nerdresolve/NerdLMS/discussions). Para
**vulnerabilidade**, veja o [SECURITY.md](SECURITY.md). Nunca em issue pública.

## Rodando o projeto

```bash
npm ci
cp infra/.env.example infra/.env.local   # ajuste SITE_ADDRESS=localhost
npm run up                                # sobe banco, storage e proxy
npm run migrate                           # aplica o schema
npm run seed                              # dados de homologação (opcional)
npm run dev
```

Node 22 ou mais novo (`.nvmrc`). Docker para banco e storage.

Sem Docker, dá para ir longe: os testes, os portões de acessibilidade e o
protótipo em `preview/` rodam sem nada instalado além do npm.

## Antes de abrir o PR

```bash
npm run verify
```

Isso roda tudo que a CI roda: testes, contraste WCAG AA, critérios da WCAG 2.2,
geração do protótipo, portões de qualidade estática, imports declarados,
hidratação, SQL, codificação de arquivo e direção das camadas. Se passa aqui,
passa lá.

## O que o projeto espera do código

**As camadas têm direção.** `frontend → backend → core`. O `core` não conhece
React nem Postgres: é regra de domínio pura, e é por isso que ela é testável
sem subir nada. `check-layers.mjs` reprova import na direção errada.

**Regra de negócio mora no `core`.** Se a regra está num componente ou numa
rota, ela não tem teste e vai divergir da próxima tela que precisar dela.

**Comentário explica o porquê, não o quê.** O código já diz o que faz. O
comentário registra a decisão: o que foi tentado antes, o que quebrou, por que
esta forma e não a óbvia. Comentário que parafraseia a linha seguinte é ruído.

**Português no que o usuário lê e no que a equipe lê.** Interface, comentário,
mensagem de commit e nome de migração em português. Identificador de código em
inglês quando for o termo técnico (`enrollment`, `tenant`), em português quando
for vocabulário do domínio (`aproveitamento`, `trilha`).

**Nada de credencial, e-mail real ou nome de cliente.** O repositório é público
e white-label. Em exemplo, use `exemplo.com.br`.

**Schema muda por migração.** Numeradas, nunca editadas depois de aplicadas. E
a migração precisa aceitar a versão ANTERIOR da aplicação: o deploy migra antes
de trocar o container, e é isso que permite voltar atrás sem restaurar backup.
Mudança que quebra a versão anterior vira duas entregas.

## Personalizar para outro cliente

Se o seu objetivo é rodar isto com outra marca, você provavelmente não precisa
de um PR, precisa do [WHITELABEL.md](WHITELABEL.md), que cobre marca, cores,
domínio e tenant sem tocar em código de produto.

Funcionalidade que só faz sentido para uma organização costuma caber melhor num
fork. O que serve a qualquer instalação é bem-vindo aqui.

## Commits

Mensagem no imperativo, explicando o efeito: `corrige contraste do hover no
tema escuro`, não `mudanças no css`. O corpo, quando existir, diz por quê.
