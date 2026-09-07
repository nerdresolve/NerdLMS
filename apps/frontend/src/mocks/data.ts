/**
 * DADOS FICTÍCIOS — a única fonte de mock do projeto.
 *
 * Tudo que é inventado vive nesta pasta. Para remover o mock quando o banco
 * entrar, basta trocar as implementações em `src/mocks/repository.ts` e apagar
 * `src/mocks/` — nenhuma tela importa daqui diretamente. Ver `src/mocks/README.md`.
 *
 * Os títulos refletem o domínio da organização (exploração de operação industrial
 * em terra, ) mas são invenção nossa. Campos e municípios citados
 * são os reais da operação.
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
  firstName: "Aluno",
  fullName: "Aluno",
  email: "maria.souza@exemplo.com",
  status: "active",
  project: "Siririzinho",
  region: "Rosário do Catete",
  lastAccessAt: acessoEm(1),
};

/** Instrutores de exemplo — autoria dos cursos do seed. */
export const instructors: User[] = [
  {
    id: "u2",
    role: "instructor",
    firstName: "Instrutor",
    fullName: "Instrutor",
    email: "rafael.nunes@exemplo.com",
    status: "active",
    project: "Unidade Norte",
    region: "Unidade Norte",
  },
  {
    id: "u3",
    role: "instructor",
    firstName: "Instrutor 2",
    fullName: "Instrutor 2",
    email: "camila.prado@exemplo.com",
    status: "active",
    project: "Riachuelo",
    region: "Japaratuba",
  },
];

/** Gestor de projeto — o "Gestor" da proposta. Ver DEC-038. */
export const manager: User = {
  id: "u4",
  role: "manager",
  firstName: "Gestor",
  fullName: "Gestor",
  email: "sergio.bastos@exemplo.com",
  status: "active",
  project: "Unidade Norte",
  region: "Unidade Norte",
  lastAccessAt: acessoEm(2),
};

export const admin: User = {
  id: "u9",
  role: "admin",
  firstName: "Administrador",
  fullName: "Administrador",
  email: "ana.ribeiro@exemplo.com",
  status: "active",
  project: "Sede",
  region: "Aracaju",
  lastAccessAt: acessoEm(0),
};

export const courses: Course[] = [
  {
    id: "c1",
    authorId: "u2",
    status: "published",
    enrollmentMode: "assigned",
    slug: "operacao-de-pocos-fundamentos",
    title: "Operação de Poços: Fundamentos",
    summary: "Do reservatório à estação coletora: as etapas que levam o óleo do poço à transferência.",
    artwork: 0,
    modules: [
      {
        id: "c1-m1",
        title: "Reservatório e completação",
        lessons: lessons("c1m1", ["Rocha, óleo e água", "Perfuração direcional", "Revestimento e cimentação", "Canhoneio"], 28),
      },
      {
        id: "c1-m2",
        title: "Elevação artificial",
        lessons: lessons("c1m2", ["Surgência e depleção", "Bombeio mecânico", "Bombeio centrífugo submerso", "Gas lift", "Escolha do método"], 30),
      },
      {
        id: "c1-m3",
        title: "Coleta e separação",
        lessons: lessons("c1m3", ["Linhas de surgência", "Estação coletora", "Separador trifásico", "Tratamento de emulsão", "Falhas comuns"], 26),
      },
      {
        id: "c1-m4",
        title: "Medição e controle",
        lessons: lessons("c1m4", ["Teste de poço", "Medição fiscal", "Análise de BSW", "Regulação da ANP"], 32),
      },
    ],
  },
  {
    id: "c2",
    authorId: "u2",
    status: "published",
    enrollmentMode: "assigned",
    slug: "integridade-de-ativos",
    title: "Integridade de Ativos e Corrosão",
    summary: "Como medir, localizar e conter a perda de espessura em linhas, vasos e tanques.",
    artwork: 1,
    modules: [
      {
        id: "c2-m1",
        title: "Mecanismos de corrosão",
        lessons: lessons("c2m1", ["Corrosão interna", "Corrosão externa", "H₂S e CO₂", "Registro de anomalias"], 24),
      },
      {
        id: "c2-m2",
        title: "Inspeção em campo",
        lessons: lessons("c2m2", ["Inspeção visual", "Medição de espessura", "Ensaio não destrutivo", "Reparo programado"], 27),
      },
      {
        id: "c2-m3",
        title: "Proteção e mitigação",
        lessons: lessons("c2m3", ["Revestimento", "Proteção catódica", "Injeção de inibidor", "Gestão de anomalias"], 26),
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
    summary: "Procedimentos obrigatórios para trabalho a quente, espaço confinado e atmosfera com H₂S.",
    artwork: 2,
    modules: [
      {
        id: "c3-m1",
        title: "Fundamentos",
        lessons: lessons("c3m1", ["Análise preliminar de risco", "EPI e EPC", "Permissão de trabalho", "Comunicação de incidentes", "Primeiros socorros"], 22),
      },
      {
        id: "c3-m2",
        title: "Trabalho a quente",
        lessons: lessons("c3m2", ["Liberação de área", "Teste de explosividade", "Bloqueio e etiquetagem", "Vigia de fogo", "Isolamento da área"], 30),
      },
      {
        id: "c3-m3",
        title: "Espaço confinado",
        lessons: lessons("c3m3", ["Identificação", "Monitoramento atmosférico", "Ventilação", "Resgate", "Supervisão de entrada"], 34),
      },
      {
        id: "c3-m4",
        title: "Emergências",
        lessons: lessons("c3m4", ["Plano de resposta", "Vazamento de H₂S", "Evacuação", "Pós-ocorrência", "Registro e análise"], 28),
      },
    ],
  },
  {
    id: "c4",
    authorId: "u3",
    status: "published",
    enrollmentMode: "open",
    slug: "relacionamento-com-comunidades",
    title: "Relacionamento com Comunidades",
    summary: "Escuta, clareza e resolução na relação com quem vive ao redor da operação.",
    artwork: 3,
    modules: [
      {
        id: "c4-m1",
        title: "A relação com a vizinhança",
        lessons: lessons("c4m1", ["Direitos e deveres", "Escuta ativa", "Linguagem clara", "Registro da manifestação", "Prazos"], 20),
      },
      {
        id: "c4-m2",
        title: "Situações críticas",
        lessons: lessons("c4m2", ["Ruído e odor", "Dano em propriedade", "Reclamação recorrente", "Escalonamento"], 24),
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
    { id: "m1", name: "Checklist de inspeção do separador", kind: "pdf", sizeLabel: "480 kB" },
    { id: "m2", name: "Planilha de acompanhamento de BSW", kind: "spreadsheet", sizeLabel: "62 kB" },
    { id: "m3", name: "Procedimento de tratamento de emulsão", kind: "pdf", sizeLabel: "1,2 MB" },
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
    body: "Na estação onde trabalho o BSW da saída sobe muito antes do fim do turno. Isso indica arraste de água no separador?",
    createdAt: "2026-08-04T13:20:00-03:00",
    highlighted: false,
  },
  {
    id: "cm2",
    upvotes: 12,
    votedByViewer: false,
    lessonId: "c1m3-l5",
    authorId: "u2",
    authorName: "Instrutor",
    body: "Boa observação, João. Subida rápida de BSW costuma indicar emulsão estável na interface. Antes de concluir, compare a vazão de entrada com o histórico: se ela subiu, o separador está apenas recebendo mais líquido e o tempo de residência caiu. Se não subiu, investigue a dosagem de desemulsificante.",
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
    authorName: "Aluno",
    body: "O trecho sobre a altura da interface no separador esclareceu uma dúvida que eu tinha há tempos. Vale rever a partir dos 12 minutos.",
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
    body: "Uma dica prática: registre o nível da interface no início e no fim do turno. Em duas semanas você já enxerga o padrão do seu separador sem precisar de planilha.",
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
    authorName: "Instrutor 2",
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
    body: "Complementando: aqui a gente adotou medir nos três níveis do tanque, e não só na boca de visita. Já achamos diferença de quase 2% entre o topo e o fundo.",
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
    body: "O que fazer quando a pessoa liga pela terceira vez no mesmo dia sobre o mesmo odor? O protocolo continua o mesmo, mas ela já está sem paciência com o roteiro.",
    createdAt: "2026-08-08T11:20:00-03:00",
    highlighted: false,
  },
  {
    id: "cm10",
    upvotes: 15,
    votedByViewer: false,
    lessonId: "c4m2-l1",
    authorId: "u3",
    authorName: "Instrutor 2",
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
    body: "A parte de trocar termo técnico por linguagem comum ajudou. Aqui a gente falava \"queima em tocha\" e a pessoa entendia que tinha pegado fogo na estação.",
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
    body: "Na medição de espessura, a linha quente do nosso trecho dá leitura instável o dia inteiro. Alguém consegue medir com a linha em operação ou aqui é caso de esperar a parada mesmo?",
    createdAt: "2026-08-10T08:15:00-03:00",
    highlighted: false,
  },
  {
    id: "cm13",
    upvotes: 18,
    votedByViewer: false,
    lessonId: "c2m2-l2",
    authorId: "u2",
    authorName: "Instrutor",
    body: "Acima de 60 °C a leitura desvia, não é preferência, é que o acoplante seca e a velocidade do som no aço muda com a temperatura. Se não der para esperar a parada, use sonda de alta temperatura e aplique a correção da tabela. Sem isso, a espessura sai menor do que é e você programa reparo que não precisa.",
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
    body: "Fiquei na dúvida entre corrosão interna e externa no exemplo do minuto 9. Pite sob depósito na parede de baixo da linha entra em qual das duas?",
    createdAt: "2026-08-11T09:05:00-03:00",
    highlighted: false,
  },
  {
    id: "cm15",
    upvotes: 11,
    votedByViewer: false,
    lessonId: "c2m1-l1",
    authorId: "u2",
    authorName: "Instrutor",
    body: "Interna. O ataque vem do fluido que passa dentro, e a água livre decanta justamente na geratriz de baixo, por isso o pite aparece ali. Externa é a que vem de fora: solo, umidade sob isolamento, corrente de interferência. A separação importa porque a defesa é diferente: uma se resolve com inibidor e pigagem, a outra com revestimento e proteção catódica.",
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
    slug: "meio-ambiente-e-licenciamento",
    title: "Meio Ambiente e Licenciamento",
    summary: "Condicionantes, monitoramento e o que a operação precisa entregar ao órgão ambiental.",
    artwork: 1,
    modules: [
      {
        id: "c5-m1",
        title: "Fundamentos",
        lessons: lessons("c5m1", ["Legislação ambiental", "Licenças e condicionantes", "O papel da operação"], 26),
      },
      {
        id: "c5-m2",
        title: "Monitoramento e passivos",
        lessons: lessons("c5m2", ["Água, solo e fauna", "Gestão de resíduos", "Recuperação de áreas"], 30),
      },
    ],
  },
  {
    id: "c6",
    authorId: "u2",
    status: "published",
    enrollmentMode: "assigned",
    slug: "processamento-de-gas",
    title: "Processamento e Tratamento de Gás",
    summary: "Do separador ao ponto de entrega: as etapas do condicionamento e os parâmetros de especificação.",
    artwork: 2,
    modules: [
      {
        id: "c6-m1",
        title: "Condicionamento",
        lessons: lessons("c6m1", ["Separação primária", "Desidratação", "Compressão", "Operação"], 24),
      },
      {
        id: "c6-m2",
        title: "Especificação e entrega",
        lessons: lessons("c6m2", ["Remoção de H₂S", "Ponto de orvalho", "Controle de processo", "Medição na entrega"], 32),
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
    summary: "Como explicar obra, intervenção e impacto para quem é afetado por eles.",
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

/* Campos e municípios reais da operação da organização . */
const PROJETOS = ["Unidade Norte", "Siririzinho", "Riachuelo", "Aguilhada"];
const REGIOES = ["Unidade Norte", "Rosário do Catete", "Japaratuba"];

function emailDe(fullName: string): string {
  return `${fullName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, ".")}@exemplo.com`;
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
    slug: "operacao-de-campo",
    title: "Operação de Campo",
    summary: "Do reservatório ao ponto de entrega: a formação completa de quem opera os campos.",
    courseIds: ["c1", "c2", "c6"],
    mode: "sequential",
  },
  {
    id: "t2",
    slug: "atendimento-e-comunidade",
    title: "Comunidade e Território",
    summary: "Como falar com quem é afetado pela operação, do primeiro contato à prestação de contas.",
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

/**
 * Como `diasDeHoje`, mas SEM SAIR DO MÊS CORRENTE.
 *
 * A agenda mostra o mês de hoje, e só ele. Um evento a `+14` dias cai no mês
 * seguinte sempre que hoje está depois do dia 16 — e o calendário aparecia com
 * marcas só no passado, como se a plataforma estivesse parada. Não era erro de
 * tela: era dado fora da janela que a tela mostra.
 *
 * Prender ao mês empilha eventos na borda quando o deslocamento é grande; por
 * isso os deslocamentos abaixo são curtos. Some junto com o mock, quando
 * eventos vierem do banco de verdade.
 */
function noMesAtual(offset: number): string {
  const hoje = new Date();
  const alvo = new Date(hoje);
  alvo.setDate(alvo.getDate() + offset);

  const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const preso = alvo < primeiro ? primeiro : alvo > ultimo ? ultimo : alvo;

  const mes = String(preso.getMonth() + 1).padStart(2, "0");
  const dia = String(preso.getDate()).padStart(2, "0");
  return `${preso.getFullYear()}-${mes}-${dia}`;
}

export const events: CalendarEvent[] = [
  { id: "e1", date: noMesAtual(-10), title: "Prazo: Segurança em Operações de Campo", kind: "deadline" },
  { id: "e2", date: noMesAtual(-5), title: "Treinamento ao vivo: Bombeio mecânico", kind: "training", time: "14h às 17h", location: "Estação Unidade Norte" },
  { id: "e3", date: noMesAtual(0), title: "Comunicado: nova norma de integridade", kind: "announcement" },
  { id: "e4", date: noMesAtual(2), title: "Treinamento ao vivo: Integração", kind: "training", time: "9h às 12h", location: "Online" },
  { id: "e5", date: noMesAtual(4), title: "Prazo: Relacionamento com Comunidades", kind: "deadline" },
  { id: "e6", date: noMesAtual(7), title: "Semana da Segurança", kind: "announcement" },
];

export const notifications: Notification[] = [
  {
    id: "n1",
    link: "/cursos/seguranca-em-operacoes-de-campo",
    title: "Seu curso de Segurança vence em 2 dias",
    body: "Faltam 20 aulas para concluir Segurança em Operações de Campo.",
    date: diasDeHoje(-1),
    kind: "reminder",
    read: false,
  },
  {
    id: "n2",
    link: "/agenda",
    title: "Novo comunicado do RH",
    body: "A nova norma de integridade entra em vigor em setembro. Leia antes do treinamento do dia 13.",
    date: diasDeHoje(-3),
    kind: "announcement",
    read: false,
  },
  {
    id: "n3",
    link: "/perfil",
    title: "Distintivo conquistado: Especialista em campo",
    body: "Você concluiu 30 aulas. Continue assim.",
    date: diasDeHoje(-5),
    kind: "achievement",
    read: true,
  },
  {
    id: "n4",
    link: "/cursos/operacao-de-pocos-fundamentos",
    title: "Instrutor respondeu seu comentário",
    body: "Em Coleta e separação · Falhas comuns.",
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
  { id: "a1", at: "2026-08-12T09:14:00-03:00", actorId: "u9", actorName: "Administrador", action: "report_exported", target: "relatório de conclusão · Unidade Norte", outcome: "allowed", ip: "200.150.10.4" },
  { id: "a2", at: "2026-08-12T09:02:00-03:00", actorId: "u2", actorName: "Instrutor", action: "course_published", target: "Operação de Poços: Fundamentos", outcome: "allowed", ip: "200.150.10.8" },
  { id: "a3", at: "2026-08-12T08:47:00-03:00", actorId: "s1", actorName: "João Peixoto", action: "access_denied", target: "progresso de outro aluno (s3)", outcome: "denied", ip: "189.44.2.19" },
  { id: "a4", at: "2026-08-12T08:46:00-03:00", actorId: "s1", actorName: "João Peixoto", action: "access_denied", target: "progresso de outro aluno (s4)", outcome: "denied", ip: "189.44.2.19" },
  { id: "a5", at: "2026-08-12T08:45:00-03:00", actorId: "s1", actorName: "João Peixoto", action: "access_denied", target: "aula de curso sem matrícula (c5)", outcome: "denied", ip: "189.44.2.19" },
  { id: "a6", at: "2026-08-12T08:30:00-03:00", actorId: "u4", actorName: "Gestor", action: "enrollment_created", target: "Bianca Ferraz · Segurança em Operações de Campo", outcome: "allowed", ip: "200.150.11.2" },
  { id: "a7", at: "2026-08-11T17:20:00-03:00", actorId: "u9", actorName: "Administrador", action: "role_changed", target: "Gestor · aluno → gestor", outcome: "allowed", ip: "200.150.10.4" },
  { id: "a8", at: "2026-08-11T16:05:00-03:00", actorId: "u3", actorName: "Instrutor 2", action: "course_deleted", target: "Rascunho sem título", outcome: "allowed", ip: "200.150.10.9" },
  { id: "a9", at: "2026-08-11T14:32:00-03:00", actorId: "u2", actorName: "Instrutor", action: "access_denied", target: "edição de curso de outro autor (c7)", outcome: "denied", ip: "200.150.10.8" },
  { id: "a10", at: "2026-08-11T09:00:00-03:00", actorId: "u9", actorName: "Administrador", action: "user_invited", target: "helena.duarte@exemplo.com", outcome: "allowed", ip: "200.150.10.4" },
  { id: "a11", at: "2026-08-10T19:41:00-03:00", actorId: "s6", actorName: "Helena Duarte", action: "login_failed", target: "senha incorreta (3ª tentativa)", outcome: "denied", ip: "177.20.88.3" },
  { id: "a12", at: "2026-08-10T11:12:00-03:00", actorId: "u9", actorName: "Administrador", action: "user_deactivated", target: "conta de teste", outcome: "allowed", ip: "200.150.10.4" },
  { id: "a13", at: "2026-08-10T08:05:00-03:00", actorId: "u1", actorName: "Aluno", action: "login", target: "sessão iniciada", outcome: "allowed", ip: "191.30.7.15" },
];
