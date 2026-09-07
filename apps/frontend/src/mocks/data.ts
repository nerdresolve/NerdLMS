/**
 * DADOS FICTÍCIOS — a única fonte de mock do projeto.
 *
 * Tudo que é inventado vive nesta pasta. Para remover o mock quando o banco
 * entrar, basta trocar as implementações em `src/mocks/repository.ts` e apagar
 * `src/mocks/` — nenhuma tela importa daqui diretamente. Ver `src/mocks/README.md`.
 *
 * Os títulos refletem o domínio da NerdResolve (saneamento) mas são invenção nossa:
 * o catálogo real tem ~70 cursos sociais e 6 para terceiros (PRD §9).
 */

import type { Course, Enrollment, LessonProgress, User } from "@nerdlms/core/courses/types.ts";

/** Data fixa como referência: o seed precisa ser igual entre execuções. */
const HOJE = new Date("2026-08-12T12:00:00-03:00");

function acessoEm(diasAtras: number): string {
  const data = new Date(HOJE);
  data.setDate(data.getDate() - diasAtras);
  return data.toISOString();
}

const MIN = 60;

function lessons(prefix: string, titles: string[], durationMinutes: number) {
  return titles.map((title, index) => ({
    id: `${prefix}-l${index + 1}`,
    title,
    durationSeconds: durationMinutes * MIN,
  }));
}

export const student: User = {
  id: "u1",
  role: "learner",
  firstName: "Maria",
  fullName: "Maria Souza",
  email: "maria.souza@exemplo.com.br",
  status: "active",
  project: "Escola Social",
  region: "Rio de Janeiro",
  lastAccessAt: acessoEm(1),
};

/** Instrutores de exemplo — autoria dos cursos do seed. */
export const instructors: User[] = [
  {
    id: "u2",
    role: "instructor",
    firstName: "Rafael",
    fullName: "Rafael Nunes",
    email: "rafael.nunes@exemplo.com.br",
    status: "active",
    project: "Águas do Rio",
    region: "Rio de Janeiro",
  },
  {
    id: "u3",
    role: "instructor",
    firstName: "Camila",
    fullName: "Camila Prado",
    email: "camila.prado@exemplo.com.br",
    status: "active",
    project: "Escola Social",
    region: "Região dos Lagos",
  },
];

/** Gestor de projeto — o "Gestor" da proposta. */
export const manager: User = {
  id: "u4",
  role: "manager",
  firstName: "Sérgio",
  fullName: "Sérgio Bastos",
  email: "sergio.bastos@exemplo.com.br",
  status: "active",
  project: "Prolagos",
  region: "Região dos Lagos",
  lastAccessAt: acessoEm(2),
};

export const admin: User = {
  id: "u9",
  role: "admin",
  firstName: "Ana",
  fullName: "Ana Ribeiro",
  email: "ana.ribeiro@exemplo.com.br",
  status: "active",
  project: "Holding",
  region: "Rio de Janeiro",
  lastAccessAt: acessoEm(0),
};

export const courses: Course[] = [
  {
    id: "c1",
    authorId: "u2",
    status: "published",
    enrollmentMode: "assigned",
    slug: "tratamento-de-agua-fundamentos",
    title: "Tratamento de Água: Fundamentos",
    summary: "Da captação à distribuição: as etapas que tornam a água potável e segura.",
    artwork: 0,
    modules: [
      {
        id: "c1-m1",
        title: "Captação e adução",
        lessons: lessons("c1m1", ["Mananciais e outorga", "Captação superficial", "Adução e recalque", "Reservação"], 28),
      },
      {
        id: "c1-m2",
        title: "Coagulação e floculação",
        lessons: lessons("c1m2", ["Química da coagulação", "Dosagem de coagulante", "Floculadores", "Ensaio de jarros", "Controle operacional"], 30),
      },
      {
        id: "c1-m3",
        title: "Decantação e filtração",
        lessons: lessons("c1m3", ["Decantadores", "Filtros rápidos", "Retrolavagem", "Perda de carga", "Falhas comuns"], 26),
      },
      {
        id: "c1-m4",
        title: "Desinfecção e controle",
        lessons: lessons("c1m4", ["Cloração", "Residual na rede", "Análises de potabilidade", "Portaria de qualidade"], 32),
      },
    ],
  },
  {
    id: "c2",
    authorId: "u2",
    status: "published",
    enrollmentMode: "assigned",
    slug: "gestao-de-perdas",
    title: "Gestão de Perdas na Distribuição",
    summary: "Como medir, localizar e reduzir perdas reais e aparentes na rede.",
    artwork: 1,
    modules: [
      {
        id: "c2-m1",
        title: "Balanço hídrico",
        lessons: lessons("c2m1", ["Indicadores de perda", "Macromedição", "Setorização", "Distritos de medição"], 24),
      },
      {
        id: "c2-m2",
        title: "Perdas reais",
        lessons: lessons("c2m2", ["Pesquisa de vazamento", "Geofonamento", "Pressão e vazamento", "Reparo programado"], 27),
      },
      {
        id: "c2-m3",
        title: "Perdas aparentes",
        lessons: lessons("c2m3", ["Submedição", "Parque de hidrômetros", "Fraudes", "Recuperação de receita"], 26),
      },
    ],
  },
  {
    id: "c3",
    authorId: "u3",
    status: "published",
    enrollmentMode: "assigned",
    slug: "seguranca-em-operacoes-de-campo",
    title: "Segurança em Operações de Campo",
    summary: "Procedimentos obrigatórios para escavação, espaço confinado e trabalho em via pública.",
    artwork: 2,
    modules: [
      {
        id: "c3-m1",
        title: "Fundamentos",
        lessons: lessons("c3m1", ["Análise de risco", "EPI e EPC", "Permissão de trabalho", "Comunicação de incidentes", "Primeiros socorros"], 22),
      },
      {
        id: "c3-m2",
        title: "Escavação e via pública",
        lessons: lessons("c3m2", ["Sinalização viária", "Escoramento de valas", "Interferências enterradas", "Reaterro", "Isolamento da área"], 30),
      },
      {
        id: "c3-m3",
        title: "Espaço confinado",
        lessons: lessons("c3m3", ["Identificação", "Monitoramento atmosférico", "Ventilação", "Resgate", "Supervisão de entrada"], 34),
      },
      {
        id: "c3-m4",
        title: "Emergências",
        lessons: lessons("c3m4", ["Plano de resposta", "Vazamento de cloro", "Evacuação", "Pós-ocorrência", "Registro e análise"], 28),
      },
    ],
  },
  {
    id: "c4",
    authorId: "u3",
    status: "published",
    enrollmentMode: "open",
    slug: "atendimento-ao-cliente",
    title: "Atendimento ao Cliente",
    summary: "Escuta, clareza e resolução na relação com o usuário do serviço.",
    artwork: 3,
    modules: [
      {
        id: "c4-m1",
        title: "A relação com o usuário",
        lessons: lessons("c4m1", ["Direitos do consumidor", "Escuta ativa", "Linguagem clara", "Registro do chamado", "Prazos"], 20),
      },
      {
        id: "c4-m2",
        title: "Situações críticas",
        lessons: lessons("c4m2", ["Falta d'água", "Conta em disputa", "Reclamação recorrente", "Escalonamento"], 24),
      },
      {
        id: "c4-m3",
        title: "Qualidade",
        lessons: lessons("c4m3", ["Indicadores de atendimento", "Pesquisa de satisfação", "Melhoria contínua", "Casos comentados", "Encerramento"], 22),
      },
    ],
  },
];

/* Data estável: mock não pode depender do relógio. */
const MOCK_COMPLETED_AT = "2026-01-01T00:00:00.000Z";

/** Marca as `count` primeiras aulas do curso como concluídas. */
function completeFirst(course: Course, count: number, lastLessonId?: string): Enrollment {
  const all = course.modules.flatMap((module) => module.lessons);
  /* O tipo é anotado porque a inferência do `fromEntries` fixaria a conclusão
     como obrigatória — e a aula de retomada, logo abaixo, não a tem. */
  const progress: Record<string, LessonProgress> = Object.fromEntries(
    /* Conclusão virou fato registrado (guia §5, migration 006): assistir tudo
       não conclui sozinho na leitura. Como este atalho existe para produzir
       aulas CONCLUÍDAS, ele grava a conclusão. */
    all.slice(0, count).map((lesson) => [
      lesson.id,
      {
        lessonId: lesson.id,
        watchedSeconds: lesson.durationSeconds,
        lastPositionSeconds: lesson.durationSeconds,
        completedAt: MOCK_COMPLETED_AT,
        completionSource: "auto" as const,
      },
    ]),
  );

  // A aula seguinte fica parcialmente assistida: é o ponto de retomada.
  const next = all[count];
  if (next) {
    const visto = Math.round(next.durationSeconds * 0.35);
    progress[next.id] = { lessonId: next.id, watchedSeconds: visto, lastPositionSeconds: visto };
  }

  return {
    courseId: course.id,
    learnerId: student.id,
    enrolledBy: "self",
    progress,
    ...(lastLessonId === undefined ? {} : { lastLessonId }),
  };
}

export const enrollments: Enrollment[] = [
  { ...completeFirst(courses[0]!, 13, "c1m3-l5"), saved: true },
  completeFirst(courses[1]!, 4),
  { courseId: "c3", learnerId: student.id, enrolledBy: "self", progress: {}, saved: true },
  completeFirst(courses[3]!, 14),
];

/* --------------------------------------------------------------- materiais */

import type { Comment, LessonMaterial } from "@nerdlms/core/courses/types.ts";

/** Anexos por aula. Chave = lessonId. */
export const materials: Record<string, LessonMaterial[]> = {
  "c1m3-l5": [
    { id: "m1", name: "Checklist de inspeção de filtros", kind: "pdf", sizeLabel: "480 kB" },
    { id: "m2", name: "Planilha de perda de carga", kind: "spreadsheet", sizeLabel: "62 kB" },
    { id: "m3", name: "Norma técnica de retrolavagem", kind: "pdf", sizeLabel: "1,2 MB" },
  ],
};

/* ------------------------------------------------------------- comentários */

/**
 * `highlighted` aqui já vem calculado porque estes dados são fictícios. No
 * produto o servidor deriva o valor de papel + autoria ao gravar (PRD §8).
 */
export const comments: Comment[] = [
  {
    id: "cm1",
    upvotes: 7,
    votedByViewer: false,
    lessonId: "c1m3-l5",
    authorId: "u5",
    authorName: "João Peixoto",
    body: "Na estação onde trabalho a perda de carga sobe muito antes das 24h previstas. Isso indica colmatação do leito?",
    createdAt: "2026-08-04T13:20:00-03:00",
    highlighted: false,
  },
  {
    id: "cm2",
    upvotes: 12,
    votedByViewer: false,
    lessonId: "c1m3-l5",
    authorId: "u2",
    authorName: "Rafael Nunes",
    body: "Boa observação, João. Subida rápida de perda de carga costuma indicar colmatação superficial. Antes de concluir, compare a turbidez de entrada com o histórico: se ela subiu, o filtro está apenas recebendo mais sólidos. Se não subiu, investigue a retrolavagem.",
    createdAt: "2026-08-04T15:02:00-03:00",
    parentId: "cm1",
    highlighted: true,
  },
  {
    id: "cm3",
    upvotes: 3,
    votedByViewer: false,
    lessonId: "c1m3-l5",
    authorId: "u1",
    authorName: "Maria Souza",
    body: "O trecho sobre expansão do leito durante a retrolavagem esclareceu uma dúvida que eu tinha há tempos. Vale rever a partir dos 12 minutos.",
    createdAt: "2026-08-05T09:44:00-03:00",
    highlighted: false,
  },
  {
    id: "cm4",
    upvotes: 5,
    votedByViewer: false,
    lessonId: "c1m3-l5",
    authorId: "s2",
    authorName: "Carla Menezes",
    body: "Uma dica prática: registre a perda de carga no início e no fim do turno. Em duas semanas você já enxerga o padrão do seu filtro sem precisar de planilha.",
    createdAt: "2026-08-05T14:10:00-03:00",
    highlighted: false,
  },
  {
    id: "cm5",
    upvotes: 0,
    votedByViewer: false,
    lessonId: "c1m3-l5",
    authorId: "s4",
    authorName: "Priscila Alves",
    body: "Alguém tem o link da norma citada no minuto 18?",
    createdAt: "2026-08-06T08:02:00-03:00",
    highlighted: false,
  },
  {
    id: "cm6",
    upvotes: 9,
    votedByViewer: false,
    lessonId: "c3m3-l2",
    authorId: "s3",
    authorName: "Diego Ramos",
    body: "Pergunta sobre o monitoramento antes da entrada: o detector aponta 19,2% de oxigênio. Está abaixo dos 20,9% do ar, mas acima do limite que a aula citou. Entra ou não entra?",
    createdAt: "2026-08-07T07:35:00-03:00",
    highlighted: false,
  },
  {
    id: "cm7",
    upvotes: 21,
    votedByViewer: false,
    lessonId: "c3m3-l2",
    authorId: "u3",
    authorName: "Camila Prado",
    body: "Não entra. O limite de 19,5% não é uma linha que separa seguro de inseguro: é o ponto em que a medição já indica que alguma coisa consumiu ou deslocou o oxigênio. Enquanto você não souber o que foi, o espaço continua sem liberação. Ventile e meça de novo. Se não voltar ao normal, o motivo está lá dentro.",
    createdAt: "2026-08-07T09:12:00-03:00",
    parentId: "cm6",
    highlighted: true,
  },
  {
    id: "cm8",
    upvotes: 4,
    votedByViewer: false,
    lessonId: "c3m3-l2",
    authorId: "s5",
    authorName: "Marcos Tavares",
    body: "Complementando: aqui a gente adotou medir nos três níveis da vala, e não só na boca. Já achamos diferença de quase 2% entre o topo e o fundo.",
    createdAt: "2026-08-07T10:48:00-03:00",
    highlighted: false,
  },
  {
    id: "cm9",
    upvotes: 6,
    votedByViewer: false,
    lessonId: "c4m2-l1",
    authorId: "s2",
    authorName: "Carla Menezes",
    body: "O que fazer quando a pessoa liga pela terceira vez no mesmo dia sobre a mesma falta d'água? O protocolo continua o mesmo, mas ela já está sem paciência com o roteiro.",
    createdAt: "2026-08-08T11:20:00-03:00",
    highlighted: false,
  },
  {
    id: "cm10",
    upvotes: 15,
    votedByViewer: false,
    lessonId: "c4m2-l1",
    authorId: "u3",
    authorName: "Camila Prado",
    body: "Nesse caso o roteiro atrapalha. Na terceira ligação a pessoa não quer a explicação de novo, quer saber o que mudou desde a última. Abra dizendo o que já foi feito e qual é a previsão atual, mesmo que a previsão seja ruim. Repetir o script do zero soa como se ninguém tivesse olhado o caso.",
    createdAt: "2026-08-08T14:05:00-03:00",
    parentId: "cm9",
    highlighted: true,
  },
  {
    id: "cm11",
    upvotes: 2,
    votedByViewer: false,
    lessonId: "c4m1-l3",
    authorId: "s7",
    authorName: "Rogério Lima",
    body: "A parte de trocar termo técnico por linguagem comum ajudou. Aqui a gente falava \"intermitência no abastecimento\" e a pessoa entendia que era problema na casa dela.",
    createdAt: "2026-08-09T16:30:00-03:00",
    highlighted: false,
  },
  {
    id: "cm12",
    upvotes: 8,
    votedByViewer: false,
    lessonId: "c2m2-l2",
    authorId: "s1",
    authorName: "João Peixoto",
    body: "No geofonamento, ruído de trânsito atrapalha muito no nosso setor. Alguém consegue fazer de dia com resultado ou aqui é caso de virar noturno mesmo?",
    createdAt: "2026-08-10T08:15:00-03:00",
    highlighted: false,
  },
  {
    id: "cm13",
    upvotes: 18,
    votedByViewer: false,
    lessonId: "c2m2-l2",
    authorId: "u2",
    authorName: "Rafael Nunes",
    body: "Em via movimentada, noturno rende mais — não é preferência, é que o ruído de fundo mascara a faixa de frequência do vazamento. Se não der para ir à noite, vale a pré-localização por setor durante o dia e reservar a escuta fina para o horário calmo. Assim você não perde o dia inteiro.",
    createdAt: "2026-08-10T10:40:00-03:00",
    parentId: "cm12",
    highlighted: true,
  },
  {
    id: "cm14",
    upvotes: 5,
    votedByViewer: false,
    lessonId: "c2m1-l1",
    authorId: "s4",
    authorName: "Priscila Alves",
    body: "Fiquei na dúvida entre perda real e perda aparente no exemplo do minuto 9. Submedição de hidrômetro entra em qual das duas?",
    createdAt: "2026-08-11T09:05:00-03:00",
    highlighted: false,
  },
  {
    id: "cm15",
    upvotes: 11,
    votedByViewer: false,
    lessonId: "c2m1-l1",
    authorId: "u2",
    authorName: "Rafael Nunes",
    body: "Aparente. A água chegou e foi consumida, só não foi medida direito — é perda de faturamento, não de água. Perda real é a que não chega: vazamento, extravasamento de reservatório. A separação importa porque o combate é diferente: uma se resolve trocando hidrômetro, a outra escavando.",
    createdAt: "2026-08-11T11:22:00-03:00",
    parentId: "cm14",
    highlighted: true,
  },
];

/* Cursos do catálogo em que a aluna ainda NÃO está matriculada — é o que a
   tela "Todos os cursos" precisa ter para a inscrição fazer sentido. */
export const catalogOnly: Course[] = [
  {
    id: "c5",
    authorId: "u3",
    status: "published",
    enrollmentMode: "open",
    slug: "saneamento-e-saude-publica",
    title: "Saneamento e Saúde Pública",
    summary: "A relação entre água tratada, esgoto coletado e indicadores de saúde na população.",
    artwork: 1,
    modules: [
      {
        id: "c5-m1",
        title: "Fundamentos",
        lessons: lessons("c5m1", ["Doenças de veiculação hídrica", "Indicadores de saúde", "O papel do saneamento"], 26),
      },
      {
        id: "c5-m2",
        title: "Território e desigualdade",
        lessons: lessons("c5m2", ["Mapeamento de vulnerabilidade", "Universalização", "Casos brasileiros"], 30),
      },
    ],
  },
  {
    id: "c6",
    authorId: "u2",
    status: "published",
    enrollmentMode: "assigned",
    slug: "tratamento-de-esgoto",
    title: "Tratamento de Esgoto: Processos",
    summary: "Do interceptor ao corpo receptor: as etapas do tratamento e os parâmetros de lançamento.",
    artwork: 2,
    modules: [
      {
        id: "c6-m1",
        title: "Tratamento preliminar",
        lessons: lessons("c6m1", ["Gradeamento", "Desarenação", "Medição de vazão", "Operação"], 24),
      },
      {
        id: "c6-m2",
        title: "Tratamento biológico",
        lessons: lessons("c6m2", ["Lodos ativados", "Reatores anaeróbios", "Controle de processo", "Lodo gerado"], 32),
      },
    ],
  },
  {
    id: "c7",
    authorId: "u3",
    status: "published",
    enrollmentMode: "open",
    slug: "comunicacao-com-a-comunidade",
    title: "Comunicação com a Comunidade",
    summary: "Como explicar obra, interrupção e tarifa para quem é afetado por elas.",
    artwork: 3,
    modules: [
      {
        id: "c7-m1",
        title: "Antes da obra",
        lessons: lessons("c7m1", ["Mapeamento de impacto", "Linguagem clara", "Canais de aviso"], 22),
      },
      {
        id: "c7-m2",
        title: "Durante e depois",
        lessons: lessons("c7m2", ["Gestão de reclamação", "Prestação de contas", "Escuta ativa"], 25),
      },
    ],
  },
];

/** Catálogo completo: matriculados e disponíveis. */
export const allCourses: Course[] = [...courses, ...catalogOnly];

/* ------------------------------------------------------------- turma ---- */

/**
 * Outros alunos, para o engajamento do instrutor ter o que medir.
 *
 * Gerados por regra, não digitados um a um: o objetivo é ter distribuição de
 * progresso — gente que não começou, gente no meio, gente que concluiu.
 */
const NOMES = [
  "João Peixoto",
  "Carla Menezes",
  "Diego Ramos",
  "Priscila Alves",
  "Marcos Tavares",
  "Helena Duarte",
  "Rogério Lima",
  "Bianca Ferraz",
];

const PROJETOS = ["Águas do Rio", "Prolagos", "Regenera Rio", "Escola Social"];
const REGIOES = ["Rio de Janeiro", "Região dos Lagos", "Baixada Fluminense"];

function emailDe(fullName: string): string {
  return `${fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, ".")}@exemplo.com.br`;
}

export const learners: User[] = NOMES.map((fullName, index) => ({
  id: `s${index + 1}`,
  role: "learner",
  firstName: fullName.split(" ")[0]!,
  fullName,
  email: emailDe(fullName),
  // Dois convidados que ainda não acessaram: é o estado que a gestão precisa ver.
  status: index === 5 || index === 7 ? "pending" : "active",
  project: PROJETOS[index % PROJETOS.length]!,
  region: REGIOES[index % REGIOES.length]!,
  // Convidado nunca acessou; os demais acessaram em dias diferentes, para o
  // relatório de período ter o que separar.
  ...(index === 5 || index === 7 ? {} : { lastAccessAt: acessoEm(index * 6) }),
}));

/** Matrículas da turma, com progresso variado e determinístico. */
export const classEnrollments: Enrollment[] = learners.flatMap((learner, index) =>
  // Cada aluno é matriculado em dois cursos, deslocando pelo catálogo.
  [courses[index % courses.length]!, courses[(index + 2) % courses.length]!].map((course, slot) => {
    const all = course.modules.flatMap((module) => module.lessons);
    // 0, 25%, 50%, 75% ou 100% das aulas, conforme a posição na lista.
    const fraction = [(index % 5) / 4, ((index + slot + 1) % 5) / 4][slot] ?? 0;
    const done = Math.round(all.length * fraction);

    return {
      courseId: course.id,
      learnerId: learner.id,
      enrolledBy: "self" as const,
      progress: Object.fromEntries(
        all.slice(0, done).map((lesson) => [
          lesson.id,
          {
            lessonId: lesson.id,
            watchedSeconds: lesson.durationSeconds,
            lastPositionSeconds: lesson.durationSeconds,
            completedAt: MOCK_COMPLETED_AT,
            completionSource: "auto" as const,
          },
        ]),
      ),
    };
  }),
);

/** Todas as matrículas da plataforma: a aluna do protótipo e a turma. */
export const allEnrollments: Enrollment[] = [...enrollments, ...classEnrollments];

/** Todo mundo, para a gestão de usuários. */
export const allUsers: User[] = [admin, manager, ...instructors, student, ...learners];

/* ------------------------------------------------------------- trilhas --- */

import type { Track } from "@nerdlms/core/courses/tracks.ts";

export const tracks: Track[] = [
  {
    id: "t1",
    slug: "operacao-de-agua",
    title: "Operação de Água",
    summary: "Do manancial à torneira: a formação completa de quem opera o sistema de abastecimento.",
    courseIds: ["c1", "c2", "c6"],
    mode: "sequential",
  },
  {
    id: "t2",
    slug: "atendimento-e-comunidade",
    title: "Atendimento e Comunidade",
    summary: "Como falar com quem é afetado pela operação, do balcão à obra na rua.",
    courseIds: ["c4", "c7"],
    mode: "free",
  },
];

/* ---------------------------------------------- agenda e comunicados ---- */

import type { CalendarEvent, Notification } from "@nerdlms/core/courses/calendar.ts";

/**
 * Data relativa a hoje, no formato ISO curto.
 *
 * As datas da agenda eram fixas (`"2026-08-10"`). Passado o dia, o aviso
 * "vence em 2 dias" aparecia com data da semana anterior e a agenda ficava
 * inteira no passado. Derivar de hoje mantém a demonstração coerente em
 * qualquer data. Some junto com o mock, quando eventos e avisos vierem do
 * banco.
 */
function diasDeHoje(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const events: CalendarEvent[] = [
  { id: "e1", date: diasDeHoje(-14), title: "Prazo: Segurança em Operações de Campo", kind: "deadline" },
  { id: "e2", date: diasDeHoje(-6), title: "Treinamento ao vivo: Retrolavagem", kind: "training", time: "14h às 17h", location: "ETA Guandu" },
  { id: "e3", date: diasDeHoje(0), title: "Comunicado: nova norma de potabilidade", kind: "announcement" },
  { id: "e4", date: diasDeHoje(7), title: "Treinamento ao vivo: Integração", kind: "training", time: "9h às 12h", location: "Online" },
  { id: "e5", date: diasDeHoje(7), title: "Prazo: Atendimento ao Cliente", kind: "deadline" },
  { id: "e6", date: diasDeHoje(14), title: "Semana da Água", kind: "announcement" },
];

export const notifications: Notification[] = [
  {
    id: "n1",
    title: "Seu curso de Segurança vence em 2 dias",
    body: "Faltam 20 aulas para concluir Segurança em Operações de Campo.",
    date: diasDeHoje(-1),
    kind: "reminder",
    read: false,
  },
  {
    id: "n2",
    title: "Novo comunicado do RH",
    body: "A nova norma de potabilidade entra em vigor em setembro. Leia antes do treinamento do dia 13.",
    date: diasDeHoje(-3),
    kind: "announcement",
    read: false,
  },
  {
    id: "n3",
    title: "Distintivo conquistado: Especialista em campo",
    body: "Você concluiu 30 aulas. Continue assim.",
    date: diasDeHoje(-5),
    kind: "achievement",
    read: true,
  },
  {
    id: "n4",
    title: "Rafael Nunes respondeu seu comentário",
    body: "Em Decantação e filtração · Falhas comuns.",
    date: diasDeHoje(-8),
    kind: "announcement",
    read: true,
  },
];

/* ----------------------------------------------------------- auditoria --- */

import type { AuditEvent } from "@nerdlms/core/courses/audit.ts";

/**
 * Inclui tentativas negadas de propósito: um IDOR bloqueado só vira sinal se
 * ficar registrado, e a tela precisa mostrar como isso aparece.
 */
export const auditEvents: AuditEvent[] = [
  { id: "a1", at: "2026-08-12T09:14:00-03:00", actorId: "u9", actorName: "Ana Ribeiro", action: "report_exported", target: "relatório de conclusão · Escola Social", outcome: "allowed", ip: "200.150.10.4" },
  { id: "a2", at: "2026-08-12T09:02:00-03:00", actorId: "u2", actorName: "Rafael Nunes", action: "course_published", target: "Tratamento de Água: Fundamentos", outcome: "allowed", ip: "200.150.10.8" },
  { id: "a3", at: "2026-08-12T08:47:00-03:00", actorId: "s1", actorName: "João Peixoto", action: "access_denied", target: "progresso de outro aluno (s3)", outcome: "denied", ip: "189.44.2.19" },
  { id: "a4", at: "2026-08-12T08:46:00-03:00", actorId: "s1", actorName: "João Peixoto", action: "access_denied", target: "progresso de outro aluno (s4)", outcome: "denied", ip: "189.44.2.19" },
  { id: "a5", at: "2026-08-12T08:45:00-03:00", actorId: "s1", actorName: "João Peixoto", action: "access_denied", target: "aula de curso sem matrícula (c5)", outcome: "denied", ip: "189.44.2.19" },
  { id: "a6", at: "2026-08-12T08:30:00-03:00", actorId: "u4", actorName: "Sérgio Bastos", action: "enrollment_created", target: "Bianca Ferraz · Segurança em Operações de Campo", outcome: "allowed", ip: "200.150.11.2" },
  { id: "a7", at: "2026-08-11T17:20:00-03:00", actorId: "u9", actorName: "Ana Ribeiro", action: "role_changed", target: "Sérgio Bastos · aluno → gestor", outcome: "allowed", ip: "200.150.10.4" },
  { id: "a8", at: "2026-08-11T16:05:00-03:00", actorId: "u3", actorName: "Camila Prado", action: "course_deleted", target: "Rascunho sem título", outcome: "allowed", ip: "200.150.10.9" },
  { id: "a9", at: "2026-08-11T14:32:00-03:00", actorId: "u2", actorName: "Rafael Nunes", action: "access_denied", target: "edição de curso de outro autor (c7)", outcome: "denied", ip: "200.150.10.8" },
  { id: "a10", at: "2026-08-11T09:00:00-03:00", actorId: "u9", actorName: "Ana Ribeiro", action: "user_invited", target: "helena.duarte@exemplo.com.br", outcome: "allowed", ip: "200.150.10.4" },
  { id: "a11", at: "2026-08-10T19:41:00-03:00", actorId: "s6", actorName: "Helena Duarte", action: "login_failed", target: "senha incorreta (3ª tentativa)", outcome: "denied", ip: "177.20.88.3" },
  { id: "a12", at: "2026-08-10T11:12:00-03:00", actorId: "u9", actorName: "Ana Ribeiro", action: "user_deactivated", target: "conta de teste", outcome: "allowed", ip: "200.150.10.4" },
  { id: "a13", at: "2026-08-10T08:05:00-03:00", actorId: "u1", actorName: "Maria Souza", action: "login", target: "sessão iniciada", outcome: "allowed", ip: "191.30.7.15" },
];
