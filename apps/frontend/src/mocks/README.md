# Dados fictícios

Tudo que é inventado no projeto está nesta pasta. Nenhuma tela e nenhuma regra
de negócio importa daqui diretamente — todas passam por `repository.ts`.

```
tela  →  features/<x>/data.ts  →  mocks/repository.ts  →  mocks/data.ts
                                        ↑
                          aqui entra o PostgreSQL
```

## Como remover o mock

1. Reescreva `repository.ts` para consultar o banco, mantendo as mesmas
   assinaturas.
2. Apague `data.ts` e este README.
3. Rode `npm test` — as regras de negócio não dependem do mock; só
   `catalog.test.ts` usa o catálogo fictício como fixture e deve migrar para
   uma fixture própria.

Nenhuma outra alteração é necessária. É essa a razão de a indireção existir.

## O que é fictício aqui

| Dado | Situação |
|------|----------|
| 4 cursos de saneamento, com módulos e aulas | Inventado. O catálogo real tem ~70 cursos sociais e 6 para terceiros |
| Aluna "Maria Souza", dois instrutores, uma administradora | Inventado |
| Progresso e matrículas | Inventado |
| `public/media/aula-demo.mp4` | Vídeo gerado por ffmpeg, 45s |
| Números da tela de acesso (`src/lib/landing.ts`) | **Vêm da referência visual, não de dados reais** |
