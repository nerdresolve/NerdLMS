/**
 * Provas de fim de curso, uma por curso.
 *
 * POR QUE FICAM AQUI, E NÃO NO `data.ts`
 *
 * São sete provas com quatro questões e quatro alternativas cada — cento e
 * doze linhas de conteúdo que nada têm a ver com o resto do catálogo. No
 * arquivo principal elas afogariam os cursos, que é o que se lê ali todo dia.
 *
 * O `build-seed.mjs` lê daqui e gera o SQL. É a mesma regra do resto do mock:
 * o dado tem UMA origem, e o banco e as telas leem a mesma coisa.
 *
 * SOBRE O CONTEÚDO: as questões são plausíveis para operação
 * onshore , e foram escritas para a plataforma ter o que mostrar —
 * não passaram por revisão técnica de ninguém da operação. Antes de virarem
 * prova de verdade, quem entende do assunto precisa lê-las.
 */

export interface MockQuestion {
  prompt: string;
  /** A correta é marcada; a ordem aqui é a ordem em que aparecem. */
  options: { text: string; correct?: boolean }[];
  /** Aparece depois de responder, quando o modo de feedback permite. */
  explanation?: string;
}

export interface MockQuiz {
  /** Id do curso no mock, como em `courses`. */
  courseId: string;
  title: string;
  description: string;
  /** Percentual mínimo para passar. */
  passingScore: number;
  timeLimitMinutes: number;
  maxAttempts: number;
  questions: MockQuestion[];
}

export const quizzes: MockQuiz[] = [
  {
    courseId: "c1",
    title: "Avaliacao final: Fundamentos de Web Moderna",
    description: "Quatro questoes sobre HTTP, layout e o caminho ate o deploy.",
    passingScore: 70,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    questions: [
      {
        prompt: "O que o codigo HTTP 304 comunica ao navegador?",
        options: [
          { text: "Que o recurso nao mudou e a copia em cache continua valida", correct: true },
          { text: "Que o recurso foi movido para outro endereco" },
          { text: "Que o servidor recusou a requisicao por falta de permissao" },
          { text: "Que o recurso foi apagado e nao sera servido de novo" },
        ],
        explanation:
          "E a resposta a uma requisicao condicional: o navegador mandou o ETag que tinha, o servidor confirmou que continua igual e devolveu 304 sem corpo, economizando a transferencia inteira.",
      },
      {
        prompt: "Num layout com Flexbox, o que `flex: 1` faz num item?",
        options: [
          { text: "Deixa o item crescer para ocupar o espaco livre, encolher quando faltar e partir de tamanho zero", correct: true },
          { text: "Fixa a largura do item em uma fracao do container" },
          { text: "Alinha o item ao centro do eixo principal" },
          { text: "Impede o item de encolher abaixo do conteudo" },
        ],
      },
      {
        prompt: "Por que `min-width: 0` costuma ser necessario num item de flex ou grid?",
        options: [
          { text: "Porque o padrao e `auto`, e o item se recusa a encolher abaixo do proprio conteudo, o que estoura o container", correct: true },
          { text: "Porque sem isso o item nao aceita `width` em porcentagem" },
          { text: "Porque o navegador ignora `overflow` em itens de flex" },
          { text: "Porque o valor `auto` desativa a quebra de linha" },
        ],
      },
      {
        prompt: "O que uma CDN resolve que o cache do navegador nao resolve?",
        options: [
          { text: "A primeira visita de cada pessoa: o conteudo ja esta perto dela, sem depender de um cache que ainda nao existe", correct: true },
          { text: "A validacao do certificado TLS" },
          { text: "A compressao do HTML no servidor de origem" },
          { text: "A ordem em que os scripts sao executados" },
        ],
      },
    ],
  },
  {
    courseId: "c2",
    title: "Avaliacao final: TypeScript na Pratica",
    description: "Quatro questoes sobre inferencia, narrowing e modelagem de dominio.",
    passingScore: 70,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    questions: [
      {
        prompt: "O que uma discriminated union permite que uma uniao comum nao permite?",
        options: [
          { text: "Estreitar o tipo checando um campo literal comum, e o compilador saber quais campos existem em cada caso", correct: true },
          { text: "Declarar campos opcionais sem usar `?`" },
          { text: "Converter um tipo em outro sem assercao" },
          { text: "Herdar campos de varias interfaces ao mesmo tempo" },
        ],
        explanation:
          "Com um campo discriminante, um `if` sobre ele faz o compilador liberar os campos daquele ramo e proibir os do outro.",
      },
      {
        prompt: "Qual a diferenca pratica entre `unknown` e `any`?",
        options: [
          { text: "`unknown` exige verificar o tipo antes de usar; `any` desliga a checagem e propaga o silencio", correct: true },
          { text: "`unknown` so aceita objetos, `any` aceita qualquer valor" },
          { text: "`unknown` e removido na compilacao, `any` permanece" },
          { text: "Nao ha diferenca: sao sinonimos" },
        ],
      },
      {
        prompt: "Por que `strictNullChecks` muda tanto codigo existente?",
        options: [
          { text: "Porque sem ele nulo e indefinido pertencem a todo tipo, e liga-lo revela cada lugar que assumia valor presente", correct: true },
          { text: "Porque ele proibe o uso de nulo no projeto inteiro" },
          { text: "Porque ele obriga a anotar o tipo de toda variavel" },
          { text: "Porque ele desativa a inferencia automatica" },
        ],
      },
      {
        prompt: "Quando uma assercao de tipo (`as`) e aceitavel?",
        options: [
          { text: "Quando voce tem informacao que o compilador nao tem e a garante de outra forma, e o comentario diz qual", correct: true },
          { text: "Sempre que o compilador reclamar, para nao travar a entrega" },
          { text: "Em qualquer valor vindo de uma API externa" },
          { text: "Nunca: `as` e sempre um defeito" },
        ],
      },
    ],
  },
  {
    courseId: "c3",
    title: "Avaliacao final: Seguranca para Quem Desenvolve",
    description: "Quatro questoes sobre injecao, sessao e tratamento de segredo.",
    passingScore: 80,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    questions: [
      {
        prompt: "Qual defesa contra SQL injection funciona por construcao?",
        options: [
          { text: "Consulta parametrizada: o valor viaja separado do comando e nunca e interpretado como SQL", correct: true },
          { text: "Escapar aspas simples no valor antes de concatenar" },
          { text: "Bloquear palavras como DROP e DELETE na entrada" },
          { text: "Limitar o tamanho do campo no formulario" },
        ],
        explanation:
          "Escapar e filtrar sao listas do que alguem lembrou de proibir. Parametrizar remove a categoria inteira: o banco recebe o comando e os dados por canais diferentes.",
      },
      {
        prompt: "Por que hash de senha precisa ser lento de proposito?",
        options: [
          { text: "Porque o atacante que rouba a base testa bilhoes de tentativas por segundo, e o custo por tentativa e a unica defesa", correct: true },
          { text: "Porque o servidor precisa de tempo para gravar o registro" },
          { text: "Porque o algoritmo lento gera hash mais longo" },
          { text: "Porque a lentidao impede forca bruta na tela de login" },
        ],
      },
      {
        prompt: "O que o atributo `SameSite=Lax` num cookie de sessao evita?",
        options: [
          { text: "Que o cookie seja enviado em requisicoes vindas de outro site, o que fecha a porta do CSRF na maior parte dos casos", correct: true },
          { text: "Que o cookie seja lido por JavaScript na propria pagina" },
          { text: "Que o cookie trafegue fora de HTTPS" },
          { text: "Que o cookie seja armazenado por mais de uma sessao" },
        ],
      },
      {
        prompt: "Um segredo entrou num commit e foi removido no commit seguinte. O que fazer?",
        options: [
          { text: "Considerar vazado e rotacionar: o valor continua no historico, e apagar depois nao o remove de quem ja clonou", correct: true },
          { text: "Nada: o commit seguinte ja resolveu" },
          { text: "Reescrever a mensagem do commit que o continha" },
          { text: "Marcar o repositorio como privado e seguir" },
        ],
      },
    ],
  },
  {
    courseId: "c4",
    title: "Avaliacao final: Comunicacao Tecnica",
    description: "Quatro questoes sobre escrita, revisao e decisao.",
    passingScore: 70,
    timeLimitMinutes: 25,
    maxAttempts: 3,
    questions: [
      {
        prompt: "O que uma boa mensagem de commit registra?",
        options: [
          { text: "Por que a mudanca foi feita, ja que o que ela faz o proprio diff mostra", correct: true },
          { text: "A lista de arquivos alterados" },
          { text: "O nome de quem pediu a mudanca" },
          { text: "O tempo gasto na implementacao" },
        ],
      },
      {
        prompt: "Numa revisao de codigo, qual comentario tende a destravar em vez de travar?",
        options: [
          { text: "O que aponta a consequencia concreta e propoe um caminho, separando o que bloqueia do que e preferencia", correct: true },
          { text: "O que lista todos os pontos de estilo em ordem" },
          { text: "O que pede reescrita sem dizer o motivo" },
          { text: "O que aprova com ressalva generica" },
        ],
      },
      {
        prompt: "Ao comunicar um incidente em andamento, o que vem primeiro?",
        options: [
          { text: "O impacto para quem usa e o que ja se sabe, mesmo sem a causa, porque quem le precisa decidir agora", correct: true },
          { text: "A causa raiz, para nao especular" },
          { text: "A linha do tempo completa desde o primeiro alerta" },
          { text: "O nome do servico que falhou e o rastro de pilha" },
        ],
      },
      {
        prompt: "O que um registro de decisao preserva que o codigo nao preserva?",
        options: [
          { text: "As alternativas descartadas e o motivo, ja que o codigo mostra a escolhida e apaga o resto", correct: true },
          { text: "A versao das dependencias no momento da decisao" },
          { text: "O desempenho medido antes e depois" },
          { text: "A lista de quem participou da reuniao" },
        ],
      },
    ],
  },
  {
    courseId: "c5",
    title: "Avaliacao final: Git e Fluxo de Trabalho",
    description: "Quatro questoes sobre historico, merge e recuperacao.",
    passingScore: 70,
    timeLimitMinutes: 25,
    maxAttempts: 3,
    questions: [
      {
        prompt: "Qual a diferenca entre `git revert` e `git reset`?",
        options: [
          { text: "`revert` cria um commit que desfaz outro e preserva o historico; `reset` move o ponteiro e reescreve o que veio depois", correct: true },
          { text: "`revert` desfaz no remoto e `reset` so no local" },
          { text: "`revert` apaga o commit e `reset` o mantem" },
          { text: "Nao ha diferenca: sao sinonimos" },
        ],
        explanation:
          "Em branch compartilhada, `revert` e a operacao segura: `reset` reescreve o que outras pessoas ja baixaram.",
      },
      {
        prompt: "Quando um rebase e problematico?",
        options: [
          { text: "Numa branch que outras pessoas ja baixaram: ele reescreve os commits e o historico delas passa a divergir", correct: true },
          { text: "Sempre que houver mais de um commit" },
          { text: "Quando a branch tem conflito com a principal" },
          { text: "Quando o repositorio tem submodulos" },
        ],
      },
      {
        prompt: "O que `git reflog` permite recuperar?",
        options: [
          { text: "Commits que deixaram de ser alcancaveis por alguma branch, depois de um reset ou de um rebase mal resolvido", correct: true },
          { text: "Arquivos que nunca chegaram a ser commitados" },
          { text: "Alteracoes descartadas antes de qualquer commit" },
          { text: "O conteudo do stash ja aplicado" },
        ],
      },
      {
        prompt: "O que torna um pull request facil de revisar?",
        options: [
          { text: "Escopo pequeno, uma intencao so, e a descricao dizendo o que verificar", correct: true },
          { text: "Ter muitos commits pequenos, um por arquivo" },
          { text: "Incluir a reformatacao do projeto inteiro junto" },
          { text: "Ter o maior numero possivel de revisores" },
        ],
      },
    ],
  },
  {
    courseId: "c6",
    title: "Avaliacao final: Bancos de Dados Relacionais",
    description: "Quatro questoes sobre indice, plano de execucao e transacao.",
    passingScore: 70,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    questions: [
      {
        prompt: "Quando um indice deixa de ser usado numa consulta?",
        options: [
          { text: "Quando a coluna aparece dentro de uma funcao ou de um calculo, porque o banco perde a correspondencia com o indice", correct: true },
          { text: "Quando a tabela tem menos de mil linhas" },
          { text: "Quando a consulta usa ordenacao" },
          { text: "Quando existe mais de um indice na mesma tabela" },
        ],
        explanation:
          "Comparar o resultado de uma funcao sobre a coluna nao usa o indice dela. Um indice sobre a expressao resolve, ou normalizar o dado na escrita.",
      },
      {
        prompt: "O que uma varredura sequencial no plano de execucao indica?",
        options: [
          { text: "Que o banco vai percorrer a tabela inteira, o que e otimo em tabela pequena e caro em tabela grande", correct: true },
          { text: "Que falta memoria para ordenar o resultado" },
          { text: "Que a consulta esta bloqueada por outra transacao" },
          { text: "Que o indice esta corrompido" },
        ],
      },
      {
        prompt: "Por que uma migracao deve aceitar a versao ANTERIOR da aplicacao?",
        options: [
          { text: "Porque o schema muda antes de o container ser trocado, e por um instante a versao antiga ainda esta atendendo", correct: true },
          { text: "Porque o banco so aplica migracoes em ordem alfabetica" },
          { text: "Porque o rollback restaura o backup automaticamente" },
          { text: "Porque a aplicacao valida o schema ao iniciar" },
        ],
      },
      {
        prompt: "O que o nivel de isolamento READ COMMITTED garante?",
        options: [
          { text: "Que a transacao so enxerga dados ja confirmados, mas duas leituras iguais podem devolver resultados diferentes", correct: true },
          { text: "Que nenhuma outra transacao escreve na tabela durante a leitura" },
          { text: "Que a mesma consulta devolve sempre o mesmo resultado" },
          { text: "Que a transacao nunca sofre deadlock" },
        ],
      },
    ],
  },
  {
    courseId: "c7",
    title: "Avaliacao final: Acessibilidade na Web",
    description: "Quatro questoes sobre contraste, foco e semantica.",
    passingScore: 70,
    timeLimitMinutes: 25,
    maxAttempts: 3,
    questions: [
      {
        prompt: "Qual o contraste minimo da WCAG AA para texto corrido?",
        options: [
          { text: "4,5:1 entre a cor do texto e a do fundo", correct: true },
          { text: "3:1, o mesmo exigido para bordas de controle" },
          { text: "7:1, que e o nivel AA para todo conteudo" },
          { text: "2:1, desde que a fonte seja maior que 16px" },
        ],
      },
      {
        prompt: "Por que remover o contorno de foco quebra a navegacao?",
        options: [
          { text: "Porque quem navega por teclado perde a unica indicacao de onde esta, e nao ha como avancar sem ver", correct: true },
          { text: "Porque o navegador passa a ignorar a ordem de tabulacao" },
          { text: "Porque o leitor de tela deixa de anunciar o elemento" },
          { text: "Porque o clique do mouse deixa de funcionar" },
        ],
      },
      {
        prompt: "Quando usar ARIA num elemento?",
        options: [
          { text: "Quando nao existe elemento HTML nativo com aquela semantica, porque o nativo sempre vem primeiro", correct: true },
          { text: "Em todo elemento interativo, por seguranca" },
          { text: "Sempre que o elemento tiver estilo customizado" },
          { text: "Apenas em formularios" },
        ],
        explanation:
          "A primeira regra do ARIA e nao usar ARIA: um botao nativo ja e anunciado, focavel e acionavel por Enter e Espaco. Reimplementar isso num elemento generico obriga a refazer os tres.",
      },
      {
        prompt: "O que o alvo minimo de 24 por 24 px da WCAG 2.5.8 protege?",
        options: [
          { text: "Quem tem dificuldade de precisao no toque ou no ponteiro e erra alvos pequenos", correct: true },
          { text: "A legibilidade do icone dentro do botao" },
          { text: "O desempenho do layout em telas pequenas" },
          { text: "A ordem de leitura do leitor de tela" },
        ],
      },
    ],
  },
];
