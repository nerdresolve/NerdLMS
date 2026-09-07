## O que muda

<!-- Uma frase. O "porquê" vai abaixo; aqui é o "o quê". -->

## Por quê

<!-- O problema que isto resolve. Se houver issue, referencie: Resolve #123 -->

## Como verificar

<!-- Os passos que um revisor segue para ver funcionando. -->

## Checklist

- [ ] `npm run verify` passa
- [ ] Não há credencial, e-mail real ou nome de cliente no diff
- [ ] Mudança de schema tem migração, e a migração aceita a versão anterior
      da aplicação (o deploy migra antes de trocar o container)
- [ ] Texto novo na interface está em português e cabe em telas estreitas
- [ ] Cor nova passa em contraste (`npm run test:a11y`)
