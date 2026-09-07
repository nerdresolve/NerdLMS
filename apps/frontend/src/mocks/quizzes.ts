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
 * SOBRE O CONTEÚDO: as questões são plausíveis para operação de petróleo
 * onshore em Sergipe, e foram escritas para a plataforma ter o que mostrar —
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
    title: "Avaliação final: Operação de Poços",
    description: "Quatro questões sobre reservatório, elevação artificial e medição.",
    passingScore: 70,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    questions: [
      {
        prompt: "O que caracteriza a elevação artificial num poço de petróleo?",
        options: [
          { text: "O uso de energia externa para trazer o fluido à superfície quando a pressão do reservatório não basta", correct: true },
          { text: "A perfuração de um poço adicional para aumentar a vazão" },
          { text: "O aquecimento do óleo dentro do reservatório" },
          { text: "A separação de gás e água ainda no fundo do poço" },
        ],
        explanation:
          "Quando a pressão natural deixa de vencer a coluna hidrostática, é preciso energia de fora, bombeio mecânico, BCP, BCS ou gas lift.",
      },
      {
        prompt: "Num sistema de bombeio mecânico, qual componente converte o movimento rotativo em alternado?",
        options: [
          { text: "A unidade de bombeio, pela manivela e pela biela", correct: true },
          { text: "A bomba de fundo" },
          { text: "A coluna de hastes" },
          { text: "O revestimento de produção" },
        ],
      },
      {
        prompt: "Qual é a função do separador na estação coletora?",
        options: [
          { text: "Separar as fases óleo, gás e água que chegam misturadas do poço", correct: true },
          { text: "Elevar a pressão do gás para o transporte" },
          { text: "Medir a vazão de cada poço individualmente" },
          { text: "Remover sedimentos do revestimento" },
        ],
      },
      {
        prompt: "Por que a medição fiscal exige rastreabilidade metrológica?",
        options: [
          { text: "Porque o volume medido define tributos e a partilha entre os envolvidos", correct: true },
          { text: "Porque a ANP exige que o medidor seja importado" },
          { text: "Porque a medição substitui o teste de produção" },
          { text: "Porque o medidor precisa operar sem energia elétrica" },
        ],
      },
    ],
  },
  {
    courseId: "c2",
    title: "Avaliação final: Integridade de Ativos",
    description: "Quatro questões sobre mecanismos de corrosão, inspeção e mitigação.",
    passingScore: 70,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    questions: [
      {
        prompt: "O que é corrosão sob isolamento (CUI)?",
        options: [
          { text: "A corrosão que ocorre sob o material isolante, alimentada por água retida e difícil de ver por fora", correct: true },
          { text: "A corrosão causada pelo próprio material isolante reagir com o aço" },
          { text: "A corrosão que só acontece em linhas enterradas" },
          { text: "Um tipo de corrosão exclusivo de tanques de teto flutuante" },
        ],
        explanation:
          "É perigosa porque a inspeção visual externa não a revela: o isolamento esconde o dano até a falha.",
      },
      {
        prompt: "Qual técnica de inspeção mede a espessura remanescente de parede sem cortar o equipamento?",
        options: [
          { text: "Ultrassom", correct: true },
          { text: "Líquido penetrante" },
          { text: "Inspeção visual direta" },
          { text: "Ensaio de dureza" },
        ],
      },
      {
        prompt: "Para que serve a proteção catódica numa tubulação enterrada?",
        options: [
          { text: "Tornar a tubulação catodo de uma célula eletroquímica, deslocando a corrosão para um anodo de sacrifício", correct: true },
          { text: "Criar uma barreira física entre o metal e o solo" },
          { text: "Elevar a temperatura da linha e evaporar a umidade" },
          { text: "Neutralizar quimicamente o H2S do fluido" },
        ],
      },
      {
        prompt: "O que a taxa de corrosão permite calcular?",
        options: [
          { text: "A vida remanescente do equipamento e o intervalo até a próxima inspeção", correct: true },
          { text: "A pressão máxima de operação do equipamento" },
          { text: "O custo de reposição do ativo" },
          { text: "A composição química do fluido transportado" },
        ],
      },
    ],
  },
  {
    courseId: "c3",
    title: "Avaliação final: Segurança em Operações de Campo",
    description: "Quatro questões sobre permissão de trabalho, espaço confinado e trabalho a quente.",
    passingScore: 80,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    questions: [
      {
        prompt: "Qual é a finalidade da Permissão de Trabalho (PT)?",
        options: [
          { text: "Garantir que os riscos foram avaliados e as medidas de controle estão em vigor antes de a tarefa começar", correct: true },
          { text: "Registrar as horas trabalhadas pela equipe" },
          { text: "Substituir a análise preliminar de risco" },
          { text: "Autorizar o acesso à área administrativa" },
        ],
      },
      {
        prompt: "Antes de entrar num espaço confinado, o que deve ser feito obrigatoriamente?",
        options: [
          { text: "Medir a atmosfera, oxigênio, gases inflamáveis e tóxicos, e manter vigia do lado de fora", correct: true },
          { text: "Aguardar trinta minutos após abrir a escotilha" },
          { text: "Entrar com dois trabalhadores para agilizar" },
          { text: "Desligar o rádio para evitar faísca" },
        ],
        explanation:
          "A atmosfera muda: a medição é contínua, não uma vez só. E o vigia não entra, quem entra para socorrer sem preparo vira a segunda vítima.",
      },
      {
        prompt: "O que caracteriza um trabalho a quente?",
        options: [
          { text: "Qualquer atividade que gere chama, faísca ou calor capaz de inflamar uma atmosfera", correct: true },
          { text: "Qualquer trabalho realizado acima de 30 °C" },
          { text: "Apenas soldagem elétrica" },
          { text: "Trabalho executado no turno da tarde" },
        ],
      },
      {
        prompt: "Numa situação de risco iminente, qual é o dever de quem observa?",
        options: [
          { text: "Interromper a atividade imediatamente, a recusa ao trabalho inseguro é um direito e um dever", correct: true },
          { text: "Registrar no relatório de fim de turno" },
          { text: "Aguardar a chegada do supervisor para decidir" },
          { text: "Continuar e comunicar depois, para não parar a operação" },
        ],
      },
    ],
  },
  {
    courseId: "c4",
    title: "Avaliação final: Relacionamento com Comunidades",
    description: "Quatro questões sobre diálogo, impacto e canais de atendimento.",
    passingScore: 70,
    timeLimitMinutes: 25,
    maxAttempts: 3,
    questions: [
      {
        prompt: "O que é uma parte interessada (stakeholder) num projeto de operação onshore?",
        options: [
          { text: "Qualquer pessoa ou grupo afetado pela operação ou capaz de afetá-la", correct: true },
          { text: "Somente os proprietários das terras onde há poços" },
          { text: "Somente os órgãos ambientais licenciadores" },
          { text: "Somente os empregados diretos da companhia" },
        ],
      },
      {
        prompt: "Por que registrar formalmente as manifestações da comunidade?",
        options: [
          { text: "Porque o registro cria rastreabilidade e permite responder, acompanhar e demonstrar tratamento", correct: true },
          { text: "Porque a legislação proíbe atendimento verbal" },
          { text: "Porque o registro substitui a resposta ao manifestante" },
          { text: "Porque só manifestações escritas têm validade" },
        ],
      },
      {
        prompt: "Qual postura é adequada diante de uma reclamação sobre ruído noturno de uma sonda?",
        options: [
          { text: "Ouvir, registrar, verificar em campo e retornar com o que foi apurado e o prazo de tratativa", correct: true },
          { text: "Explicar que o ruído está dentro da norma e encerrar o assunto" },
          { text: "Encaminhar ao jurídico sem responder ao morador" },
          { text: "Aguardar novas reclamações para confirmar o problema" },
        ],
      },
      {
        prompt: "O que diferencia comunicação de engajamento comunitário?",
        options: [
          { text: "Comunicação informa; engajamento envolve a comunidade na construção das decisões que a afetam", correct: true },
          { text: "Comunicação é escrita; engajamento é presencial" },
          { text: "Comunicação é da empresa; engajamento é do órgão ambiental" },
          { text: "Não há diferença prática entre os dois" },
        ],
      },
    ],
  },
  {
    courseId: "c5",
    title: "Avaliação final: Meio Ambiente e Licenciamento",
    description: "Quatro questões sobre licenças, condicionantes e resposta a incidentes.",
    passingScore: 70,
    timeLimitMinutes: 25,
    maxAttempts: 3,
    questions: [
      {
        prompt: "Qual licença autoriza o início da operação de uma instalação já construída?",
        options: [
          { text: "Licença de Operação (LO)", correct: true },
          { text: "Licença Prévia (LP)" },
          { text: "Licença de Instalação (LI)" },
          { text: "Autorização de Supressão Vegetal" },
        ],
      },
      {
        prompt: "O que são condicionantes de uma licença ambiental?",
        options: [
          { text: "Obrigações específicas que o empreendedor deve cumprir e comprovar para manter a licença válida", correct: true },
          { text: "Recomendações sem caráter obrigatório" },
          { text: "Prazos de validade da licença" },
          { text: "Taxas cobradas pelo órgão ambiental" },
        ],
      },
      {
        prompt: "Diante de um vazamento de óleo em solo, qual é a primeira ação?",
        options: [
          { text: "Estancar a fonte com segurança e conter o avanço antes de qualquer remediação", correct: true },
          { text: "Coletar amostras para o laboratório" },
          { text: "Comunicar a imprensa local" },
          { text: "Iniciar a remoção do solo contaminado" },
        ],
        explanation:
          "Remediar sem estancar é enxugar gelo: a fonte continua alimentando o dano enquanto a equipe trabalha.",
      },
      {
        prompt: "Por que a destinação de resíduos exige documento de rastreabilidade?",
        options: [
          { text: "Porque a responsabilidade pelo resíduo acompanha o gerador até a destinação final", correct: true },
          { text: "Porque o transportador exige nota fiscal" },
          { text: "Porque o documento reduz o custo do transporte" },
          { text: "Porque o resíduo perde classificação após a coleta" },
        ],
      },
    ],
  },
  {
    courseId: "c6",
    title: "Avaliação final: Processamento e Tratamento de Gás",
    description: "Quatro questões sobre desidratação, compressão e especificação.",
    passingScore: 70,
    timeLimitMinutes: 30,
    maxAttempts: 3,
    questions: [
      {
        prompt: "Por que o gás natural precisa ser desidratado antes do transporte?",
        options: [
          { text: "Para evitar formação de hidratos e corrosão na tubulação", correct: true },
          { text: "Para aumentar o poder calorífico do gás" },
          { text: "Para reduzir o volume transportado" },
          { text: "Para separar o metano do etano" },
        ],
      },
      {
        prompt: "Qual substância é usada na desidratação por absorção?",
        options: [
          { text: "Trietilenoglicol (TEG)", correct: true },
          { text: "Ácido sulfúrico" },
          { text: "Metanol puro" },
          { text: "Água desmineralizada" },
        ],
      },
      {
        prompt: "O que é o ponto de orvalho de hidrocarbonetos?",
        options: [
          { text: "A temperatura em que os hidrocarbonetos mais pesados começam a condensar", correct: true },
          { text: "A temperatura de ignição do gás" },
          { text: "A pressão máxima de operação do compressor" },
          { text: "A temperatura em que o gás congela" },
        ],
      },
      {
        prompt: "Para que serve o tratamento de remoção de H2S?",
        options: [
          { text: "Para atender à especificação e evitar toxicidade e corrosão ácida", correct: true },
          { text: "Para elevar a pressão de entrega" },
          { text: "Para aumentar a densidade do gás" },
          { text: "Para permitir a medição fiscal" },
        ],
      },
    ],
  },
  {
    courseId: "c7",
    title: "Avaliação final: Comunicação com a Comunidade",
    description: "Quatro questões sobre linguagem, canais e transparência.",
    passingScore: 70,
    timeLimitMinutes: 25,
    maxAttempts: 3,
    questions: [
      {
        prompt: "Ao comunicar um desvio operacional à comunidade, o que deve vir primeiro?",
        options: [
          { text: "O que aconteceu, o que já foi feito e o que ainda será feito, em linguagem simples", correct: true },
          { text: "A explicação técnica detalhada do equipamento envolvido" },
          { text: "A garantia de que não houve risco, antes da apuração" },
          { text: "O histórico de conformidade da empresa" },
        ],
      },
      {
        prompt: "Por que evitar jargão técnico na comunicação comunitária?",
        options: [
          { text: "Porque a mensagem que não é entendida não foi comunicada, e o vazio é preenchido por boato", correct: true },
          { text: "Porque o jargão é proibido pela legislação" },
          { text: "Porque encarece a produção do material" },
          { text: "Porque a comunidade não tem interesse em detalhes" },
        ],
      },
      {
        prompt: "Qual é o papel do canal de atendimento à comunidade?",
        options: [
          { text: "Receber manifestações, dar resposta rastreável e alimentar a melhoria da operação", correct: true },
          { text: "Divulgar os resultados financeiros da companhia" },
          { text: "Substituir as reuniões públicas do licenciamento" },
          { text: "Registrar apenas elogios e sugestões" },
        ],
      },
      {
        prompt: "O que compromete a confiança construída com a comunidade?",
        options: [
          { text: "Prometer prazo que não se cumpre e não voltar para explicar por quê", correct: true },
          { text: "Informar que um assunto ainda está em apuração" },
          { text: "Reconhecer publicamente um erro da operação" },
          { text: "Convidar moradores para visitar a instalação" },
        ],
      },
    ],
  },
];
