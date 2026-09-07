/**
 * Ligação entre o estado do aluno e o DOM do protótipo.
 *
 * A regra de negócio NÃO mora aqui: vem de `src/lib/store/learner-store.js`,
 * o mesmo módulo que o app React usa. Este arquivo só lê o DOM, chama a store
 * e repinta. Se algo aqui parecer regra, está no lugar errado.
 */

(function () {
  "use strict";

  var store = window.NERD_STORE;
  if (!store) return;

  store.hydrate(window.NERD_SEED || {});

  /* ---------------------------------------------------- concluir aula ---- */

  function repaintLesson() {
    var rows = document.querySelectorAll(".lesson[data-lesson-id]");
    if (!rows.length) return;

    Array.prototype.forEach.call(rows, function (row) {
      var id = row.dataset.lessonId;
      var duration = Number(row.dataset.duration || 0);
      var done = store.isLessonComplete(id, duration);
      if (done && row.dataset.state !== "current") row.dataset.state = "done";
      var marker = row.querySelector(".lesson__marker");
      if (done && marker && !marker.querySelector("svg")) {
        marker.innerHTML = '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>';
      }
    });

    // Percentual por módulo e do curso, com a mesma fórmula da store.
    var totalDone = 0;
    var totalAll = 0;
    Array.prototype.forEach.call(document.querySelectorAll("[data-module]"), function (group) {
      var lessons = group.querySelectorAll(".lesson[data-lesson-id]");
      var done = 0;
      Array.prototype.forEach.call(lessons, function (row) {
        if (store.isLessonComplete(row.dataset.lessonId, Number(row.dataset.duration || 0))) done += 1;
      });
      totalDone += done;
      totalAll += lessons.length;

      var percent = window.NERD_PERCENT(done, lessons.length);
      var label = group.querySelector("[data-module-percent]");
      if (label) {
        label.textContent = percent + "%";
        label.dataset.complete = String(percent === 100);
      }
      var bar = group.querySelector("[data-module-bar]");
      if (bar) {
        bar.style.setProperty("--value", percent + "%");
        bar.setAttribute("aria-valuenow", String(percent));
      }
    });

    if (totalAll > 0) {
      var coursePercent = window.NERD_PERCENT(totalDone, totalAll);
      Array.prototype.forEach.call(document.querySelectorAll("[data-course-percent]"), function (el) {
        el.textContent = coursePercent + "%";
      });
      Array.prototype.forEach.call(document.querySelectorAll("[data-course-bar]"), function (bar) {
        bar.style.setProperty("--value", coursePercent + "%");
        bar.setAttribute("aria-valuenow", String(coursePercent));
      });
    }
  }

  /* --- Agregados (dashboard e perfil) ---

     Estes números eram gerados no build a partir do seed e ficavam parados:
     concluir uma aula mudava a tela da aula e não mexia em "31 de 64" nem no
     anel. No produto eles vêm de contagem no banco e acompanham; aqui a conta
     é refeita no navegador, com o catálogo injetado pelo build.

     Só toca em elementos marcados com `data-agg` / `data-card-*`: numa página
     que não os tem — a de aula, por exemplo — a função não faz nada. */
  function refreshAggregates() {
    var catalogo = window.NERD_CATALOG;
    if (!catalogo) return;

    var totalAulas = 0;
    var totalConcluidas = 0;
    var cursosConcluidos = 0;
    var porCurso = {};

    catalogo.forEach(function (curso) {
      var feitas = 0;
      curso.lessons.forEach(function (aula) {
        if (store.isLessonComplete(aula.id, aula.duration)) feitas += 1;
      });
      porCurso[curso.id] = { feitas: feitas, total: curso.lessons.length };

      /* Só cursos em que a pessoa está matriculada entram no total — o
         catálogo traz a biblioteca inteira, e somar curso alheio inflaria o
         denominador que a tela mostra como "seu progresso". */
      if (store.isEnrolled ? store.isEnrolled(curso.id) : true) {
        totalAulas += curso.lessons.length;
        totalConcluidas += feitas;
        if (curso.lessons.length > 0 && feitas === curso.lessons.length) cursosConcluidos += 1;
      }
    });

    var matriculados = catalogo.filter(function (curso) {
      return store.isEnrolled ? store.isEnrolled(curso.id) : true;
    }).length;

    var alvoAulas = document.querySelector('[data-agg="lessons"]');
    if (alvoAulas) alvoAulas.textContent = totalConcluidas + " de " + totalAulas;

    var alvoCursos = document.querySelector('[data-agg="courses"]');
    if (alvoCursos) alvoCursos.textContent = cursosConcluidos + " de " + matriculados;

    var percentual = window.NERD_PERCENT(totalConcluidas, totalAulas);
    var alvoPercent = document.querySelector('[data-agg="percent"]');
    if (alvoPercent) alvoPercent.textContent = percentual + "%";

    var anel = document.querySelector(".ring__value");
    if (anel) {
      /* O anel é desenhado por `stroke-dasharray`: o comprimento pintado é a
         fração do perímetro. Sem atualizar isto, o número muda e o desenho
         não. */
      var raio = Number(anel.getAttribute("r") || 0);
      var perimetro = 2 * Math.PI * raio;
      anel.setAttribute("stroke-dasharray", perimetro.toFixed(2));
      anel.setAttribute("stroke-dashoffset", (perimetro * (1 - percentual / 100)).toFixed(2));
    }

    /* O perfil mostra o mesmo dado noutro formato: o número no valor e o
       denominador dentro do rótulo ("32" / "de 64 aulas concluídas"). */
    Array.prototype.forEach.call(document.querySelectorAll("[data-card-agg]"), function (cartao) {
      var qual = cartao.dataset.cardAgg;
      var valor = cartao.querySelector(".stat-card__value");
      var rotulo = cartao.querySelector(".stat-card__label");
      if (!valor) return;

      if (qual === "lessons") {
        valor.textContent = String(totalConcluidas);
        if (rotulo) rotulo.textContent = "de " + totalAulas + " aulas conclu\u00eddas";
      } else if (qual === "courses") {
        valor.textContent = String(cursosConcluidos);
        if (rotulo) rotulo.textContent = "de " + matriculados + " cursos conclu\u00eddos";
      } else if (qual === "percent") {
        valor.textContent = percentual + "%";
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-card-course]"), function (card) {
      var dados = porCurso[card.dataset.cardCourse];
      if (!dados) return;
      var pct = window.NERD_PERCENT(dados.feitas, dados.total);

      var conta = card.querySelector("[data-card-count]");
      if (conta) conta.textContent = dados.feitas + " de " + dados.total;

      var chip = card.querySelector("[data-card-percent]");
      if (chip) chip.textContent = pct + "%";

      var barra = card.querySelector("[data-card-bar]");
      if (barra) {
        barra.style.setProperty("--value", pct + "%");
        barra.setAttribute("aria-valuenow", String(pct));
      }
    });
  }

  /* Uma vez na carga (a página vem do build com os números do seed) e a cada
     mudança da store. */
  refreshAggregates();
  store.subscribe(refreshAggregates);

  var completeButton = document.getElementById("concluir");
  if (completeButton) {
    var refresh = function () {
      var id = completeButton.dataset.lessonId;
      var duration = Number(completeButton.dataset.duration || 0);
      var done = store.isLessonComplete(id, duration);
      completeButton.disabled = done;
      completeButton.textContent = done ? "Aula concluída" : "Concluir aula";
      var badge = document.getElementById("estado-aula");
      if (badge) badge.hidden = !done;
    };

    completeButton.addEventListener("click", function () {
      store.completeLesson(completeButton.dataset.lessonId, Number(completeButton.dataset.duration || 0));
      var status = document.getElementById("aula-status");
      if (status) status.textContent = "Aula marcada como concluída. Seu progresso foi atualizado.";
    });

    store.subscribe(function () {
      refresh();
      repaintLesson();
    });
    refresh();
  }

  repaintLesson();

  /* ------------------------------------------------------- salvar curso -- */

  function repaintSaved() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-save-course]"), function (button) {
      var saved = store.isSaved(button.dataset.saveCourse);
      button.setAttribute("aria-pressed", String(saved));
      button.setAttribute("aria-label", saved ? "Remover dos favoritos" : "Salvar nos favoritos");
      var use = button.querySelector("use");
      if (use) use.setAttribute("href", saved ? "#i-star" : "#i-bookmark");
    });

    // Na lista de favoritos, esconder o que foi removido e revelar o que entrou.
    var grid = document.getElementById("grid");
    if (grid && document.body.dataset.filter === "saved") {
      var visiveis = 0;
      Array.prototype.forEach.call(grid.children, function (card) {
        var mostrar = store.isSaved(card.dataset.courseId);
        card.hidden = !mostrar;
        if (mostrar) visiveis += 1;
      });
      var vazio = document.querySelector(".empty");
      if (vazio) vazio.hidden = visiveis > 0;
      grid.hidden = visiveis === 0;
      var status = document.getElementById("status");
      if (status) status.textContent = visiveis === 1 ? "1 curso encontrado" : visiveis + " cursos encontrados";
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-save-course]"), function (button) {
    button.addEventListener("click", function () {
      store.toggleSaved(button.dataset.saveCourse);
      var status = document.getElementById("curso-status");
      if (status) {
        status.textContent = store.isSaved(button.dataset.saveCourse)
          ? "Curso salvo. Ele aparece em Favoritos."
          : "Curso removido dos favoritos.";
      }
    });
  });

  store.subscribe(repaintSaved);
  repaintSaved();

  /* ------------------------------------------------------------ inscrição -- */

  Array.prototype.forEach.call(document.querySelectorAll("[data-enroll]"), function (button) {
    var card = button.closest(".course-card");
    var courseId = button.dataset.enroll;

    function paint() {
      if (!store.isEnrolled(courseId)) return;
      button.disabled = true;
      button.textContent = "Inscrito";
      if (card) card.dataset.status = "not_started";
    }

    button.addEventListener("click", function () {
      store.enroll(courseId);
      var status = document.getElementById("status");
      if (status) status.textContent = "Inscrição confirmada. O curso aparece em Meus cursos.";
    });

    store.subscribe(paint);
    paint();
  });

  /* --------------------------------------------------------- comentários -- */

  /**
   * Monta o nó de um comentário.
   * O texto do aluno entra por textContent, nunca innerHTML: é entrada não
   * confiável e o hábito precisa nascer certo, mesmo no protótipo.
   */
  function commentNode(authorName, initials, body) {
    var article = document.createElement("article");
    article.className = "comment";
    article.innerHTML =
      '<span class="avatar avatar--sm" aria-hidden="true"></span>' +
      '<div class="comment__body"><div class="comment__head">' +
      '<span class="comment__author"></span><span class="comment__time">agora</span></div>' +
      '<p class="comment__text"></p></div>';
    article.querySelector(".avatar").textContent = initials;
    article.querySelector(".comment__author").textContent = authorName;
    article.querySelector(".comment__text").textContent = body;
    return article;
  }

  /* --- Responder a um comentário --- */
  function wireReply(button) {
    button.addEventListener("click", function () {
      var body = button.closest(".comment__body");
      if (body.querySelector(".composer")) return; // já aberto

      var form = document.createElement("form");
      form.className = "composer";
      form.innerHTML =
        '<div class="composer__body">' +
        '<textarea class="textarea" rows="2" aria-label="Sua resposta" placeholder="Escreva sua resposta…"></textarea>' +
        '<div class="composer__actions">' +
        '<button type="button" class="btn btn--secondary" data-cancelar>Cancelar</button>' +
        '<button type="submit" class="btn btn--primary" disabled>Responder</button>' +
        "</div></div>";

      var area = form.querySelector("textarea");
      var enviar = form.querySelector('button[type="submit"]');
      area.addEventListener("input", function () {
        enviar.disabled = area.value.trim().length === 0;
      });
      form.querySelector("[data-cancelar]").addEventListener("click", function () {
        form.remove();
        button.focus();
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var texto = area.value.trim();
        if (!texto) return;

        var parentId = button.closest(".comment").dataset.commentId;
        store.addComment({
          lessonId: document.getElementById("composer").dataset.lessonId,
          authorId: window.NERD_USER.id,
          authorName: window.NERD_USER.name,
          body: texto,
          parentId: parentId,
        });

        var replies = body.querySelector(".comment__replies");
        if (!replies) {
          replies = document.createElement("div");
          replies.className = "comment__replies";
          body.appendChild(replies);
        }
        replies.appendChild(commentNode(window.NERD_USER.name, window.NERD_USER.initials, texto));
        form.remove();
        document.getElementById("comentario-status").textContent = "Resposta publicada.";
      });

      body.appendChild(form);
      area.focus();
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-reply]"), wireReply);

  var composer = document.getElementById("composer");
  if (composer) {
    var textarea = document.getElementById("novo-comentario");
    var publicar = document.getElementById("publicar");
    var list = document.querySelector(".comment-list");
    var count = document.querySelector(".comments__count");
    var lessonId = composer.dataset.lessonId;

    textarea.addEventListener("input", function () {
      publicar.disabled = textarea.value.trim().length === 0;
    });

    composer.addEventListener("submit", function (event) {
      event.preventDefault();
      var body = textarea.value.trim();
      if (!body) return;

      var comment = store.addComment({
        lessonId: lessonId,
        authorId: window.NERD_USER.id,
        authorName: window.NERD_USER.name,
        body: body,
      });

      var article = commentNode(window.NERD_USER.name, window.NERD_USER.initials, comment.body);
      article.dataset.commentId = comment.id;
      list.appendChild(article);
      textarea.value = "";
      publicar.disabled = true;
      count.textContent = String(list.querySelectorAll(".comment").length);
      document.getElementById("comentario-status").textContent = "Comentário publicado.";
    });
  }

  /* ---------------------------------------------------------- votos ------ */

  var restante = document.querySelector("[data-votes-left]");
  if (restante) {
    var ORCAMENTO = Number(restante.textContent) || 10;
    var usados = 0;
    var votados = {};

    function atualizarOrcamento() {
      var sobra = Math.max(0, ORCAMENTO - usados);
      restante.textContent = String(sobra);
      Array.prototype.forEach.call(document.querySelectorAll("[data-upvote]"), function (button) {
        var proprio = button.dataset.author === window.NERD_USER.id;
        var jaVotou = votados[button.dataset.upvote] === true;
        button.disabled = proprio || jaVotou || sobra <= 0;
        button.setAttribute("aria-pressed", String(jaVotou));
        if (proprio) button.title = "Não é possível votar no próprio comentário.";
        else if (jaVotou) button.title = "Você já votou neste comentário.";
        else if (sobra <= 0) button.title = "Seus votos da semana acabaram. Eles voltam na segunda-feira.";
        else button.title = "";
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll("[data-upvote]"), function (button) {
      button.addEventListener("click", function () {
        var id = button.dataset.upvote;
        if (votados[id] || button.disabled) return;

        votados[id] = true;
        usados += 1;

        var contador = button.querySelector("[data-upvote-count]");
        contador.textContent = String(Number(contador.textContent) + 1);
        atualizarOrcamento();

        document.getElementById("comentario-status").textContent =
          "Voto registrado. O autor ganhou 5 moedas NerdResolve.";
      });
    });

    atualizarOrcamento();
  }

  /* ---------------------------------------------------- progresso do vídeo -- */

  var video = document.getElementById("video");
  var completeBtn = document.getElementById("concluir");
  if (video && completeBtn) {
    var lessonId = completeBtn.dataset.lessonId;
    var declared = Number(completeBtn.dataset.duration || 0);
    var lastSaved = 0;

    video.addEventListener("timeupdate", function () {
      if (!video.duration) return;

      // O vídeo de demonstração é mais curto que a aula real: a posição é
      // convertida em fração para o progresso fazer sentido nos dois casos.
      var seconds = Math.round((video.currentTime / video.duration) * declared);

      // Grava a cada 5s de avanço, não a cada quadro: no produto isso vira
      // uma requisição, e uma por quadro derrubaria o servidor.
      if (seconds - lastSaved < 5) return;
      lastSaved = seconds;
      store.trackProgress(lessonId, seconds);
    });
  }

  /* ------------------------------------------------- editor de curso ---- */

  var editor = document.getElementById("editor");
  if (editor) {
    var courseId = editor.dataset.courseId;
    var draft = store.openDraft(window.NERD_COURSE);
    var modulesRoot = document.getElementById("modulos");

    function minutos(seconds) {
      var m = Math.round((seconds || 0) / 60);
      return m + "min";
    }

    function renderModules() {
      var current = store.getDraft(courseId);
      modulesRoot.textContent = "";

      current.modules.forEach(function (module, index) {
        var box = document.createElement("div");
        box.className = "editor-module";

        var head = document.createElement("div");
        head.className = "editor-module__head";
        var title = document.createElement("span");
        title.className = "editor-module__title";
        title.textContent = "Módulo " + (index + 1) + " — " + module.title;
        var count = document.createElement("span");
        count.className = "editor-module__count";
        count.textContent = module.lessons.length + " aulas";
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "comment__action";
        remove.textContent = "Remover módulo";
        remove.addEventListener("click", function () {
          store.removeModule(courseId, module.id);
        });
        head.append(title, count, remove);

        var lessons = document.createElement("div");
        lessons.className = "editor-lessons";
        module.lessons.forEach(function (lesson) {
          var row = document.createElement("div");
          row.className = "editor-lesson";
          var name = document.createElement("span");
          name.className = "editor-lesson__title";
          name.textContent = lesson.title;
          var duration = document.createElement("span");
          duration.className = "editor-lesson__duration";
          duration.textContent = minutos(lesson.durationSeconds);
          var drop = document.createElement("button");
          drop.type = "button";
          drop.className = "comment__action";
          drop.textContent = "Remover";
          drop.addEventListener("click", function () {
            store.removeLesson(courseId, module.id, lesson.id);
          });
          row.append(name, duration, drop);
          lessons.appendChild(row);
        });

        var form = document.createElement("form");
        form.className = "editor-add";
        form.innerHTML =
          '<input class="input" type="text" aria-label="Título da aula" placeholder="Nome da aula" />' +
          '<input class="input input--duration" type="number" min="1" aria-label="Duração em minutos" placeholder="min" />' +
          '<button type="submit" class="btn btn--secondary">Adicionar aula</button>';
        form.addEventListener("submit", function (event) {
          event.preventDefault();
          var campos = form.querySelectorAll("input");
          if (!campos[0].value.trim()) {
            campos[0].focus();
            return;
          }
          store.addLesson(courseId, module.id, { title: campos[0].value, durationMinutes: campos[1].value });
        });

        box.append(head, lessons, form);
        modulesRoot.appendChild(box);
      });

      var totalAulas = current.modules.reduce(function (sum, module) {
        return sum + module.lessons.length;
      }, 0);
      var totalSegundos = current.modules.reduce(function (sum, module) {
        return sum + module.lessons.reduce(function (acc, lesson) { return acc + (lesson.durationSeconds || 0); }, 0);
      }, 0);

      document.getElementById("total-modulos").textContent = String(current.modules.length);
      document.getElementById("total-aulas").textContent = String(totalAulas);
      document.getElementById("total-duracao").textContent =
        totalSegundos >= 3600
          ? Math.floor(totalSegundos / 3600) + "h " + Math.round((totalSegundos % 3600) / 60) + "min"
          : Math.round(totalSegundos / 60) + "min";

      var situacao = document.getElementById("situacao");
      var publicado = current.status === "published";
      situacao.textContent = publicado ? "Publicado" : "Rascunho";
      situacao.className = "badge " + (publicado ? "badge--success" : "badge--neutral");
    }

    document.getElementById("novo-modulo").addEventListener("submit", function (event) {
      event.preventDefault();
      var campo = document.getElementById("modulo-titulo");
      store.addModule(courseId, campo.value);
      campo.value = "";
    });

    document.getElementById("curso-titulo").addEventListener("input", function (event) {
      store.updateDraft(courseId, { title: event.target.value });
    });
    document.getElementById("curso-resumo").addEventListener("input", function (event) {
      store.updateDraft(courseId, { summary: event.target.value });
    });

    document.getElementById("publicar-curso").addEventListener("click", function () {
      var resultado = store.publishDraft(courseId);
      document.getElementById("publicar-status").textContent = resultado.ok
        ? "Curso publicado. Ele passa a aparecer no catálogo dos alunos."
        : resultado.reason;
    });

    var dropzone = document.getElementById("dropzone");
    function avisarUpload() {
      document.getElementById("upload-status").textContent =
        "O envio de arquivo só funciona na aplicação, com o armazenamento configurado. Nada foi enviado.";
    }
    dropzone.addEventListener("click", avisarUpload);
    dropzone.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        avisarUpload();
      }
    });
    dropzone.addEventListener("dragover", function (event) { event.preventDefault(); });
    dropzone.addEventListener("drop", function (event) { event.preventDefault(); avisarUpload(); });

    store.subscribe(renderModules);
    renderModules();
  }

  /* ----------------------------------------------------------- admin ---- */

  Array.prototype.forEach.call(document.querySelectorAll("[data-export]"), function (button) {
    button.addEventListener("click", function () {
      document.getElementById("export-status").textContent =
        "Exportação em " +
        (button.dataset.export === "pdf" ? "PDF" : "Excel") +
        " só funciona na aplicação. Nada foi gerado.";
    });
  });

  var buscaUsuario = document.getElementById("busca-usuario");
  if (buscaUsuario) {
    var linhas = Array.prototype.slice.call(document.querySelectorAll("#usuarios tr"));

    function normalizar(texto) {
      return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    }

    buscaUsuario.addEventListener("input", function () {
      var termo = normalizar(buscaUsuario.value.trim());
      var visiveis = 0;
      linhas.forEach(function (linha) {
        var mostrar = !termo || normalizar(linha.textContent).indexOf(termo) > -1;
        linha.hidden = !mostrar;
        if (mostrar) visiveis += 1;
      });
      document.getElementById("usuario-status").textContent =
        visiveis === 1 ? "1 pessoa encontrada" : visiveis + " pessoas encontradas";
    });
  }

  var novoUsuario = document.getElementById("novo-usuario");
  if (novoUsuario) {
    novoUsuario.addEventListener("click", function () {
      document.getElementById("usuario-status").textContent =
        "O convite só funciona na aplicação, com o envio de e-mail configurado.";
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-user-action]"), function (button) {
    button.addEventListener("click", function () {
      document.getElementById("usuario-status").textContent =
        button.dataset.userAction === "editar"
          ? "Edição de usuário só funciona na aplicação."
          : "Desativação só funciona na aplicação. Nenhum acesso foi alterado.";
    });
  });

  /* ----------------------------------------------------------- gestor ---- */

  var buscaEquipe = document.getElementById("busca-equipe");
  if (buscaEquipe) {
    var pessoas = Array.prototype.slice.call(document.querySelectorAll("#equipe tr"));

    buscaEquipe.addEventListener("input", function () {
      var termo = buscaEquipe.value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      var visiveis = 0;
      pessoas.forEach(function (linha) {
        var texto = linha.textContent.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        var mostrar = !termo || texto.indexOf(termo) > -1;
        linha.hidden = !mostrar;
        if (mostrar) visiveis += 1;
      });
      document.getElementById("equipe-status").textContent =
        visiveis === 1 ? "1 pessoa encontrada" : visiveis + " pessoas encontradas";
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-assign]"), function (button) {
    button.addEventListener("click", function () {
      document.getElementById("equipe-status").textContent =
        "A matrícula atribuída só funciona na aplicação. Nenhum acesso foi alterado.";
    });
  });

  /* ------------------------------------------------------- recompensas -- */

  Array.prototype.forEach.call(document.querySelectorAll("[data-reward]"), function (button) {
    button.addEventListener("click", function () {
      document.getElementById("resgate-status").textContent =
        "O resgate só funciona na aplicação, com o catálogo definido pelo RH. Nenhuma moeda foi debitada.";
    });
  });

  /* ------------------------------------------------------------- agenda -- */

  Array.prototype.forEach.call(document.querySelectorAll("[data-month]"), function (button) {
    button.addEventListener("click", function () {
      document.getElementById("mes-status").textContent =
        "A navegação entre meses só funciona na aplicação. O calendário mostra agosto de 2026.";
    });
  });

  /* ---------------------------------------------------------- auditoria -- */

  var buscaAuditoria = document.getElementById("busca-auditoria");
  if (buscaAuditoria) {
    var linhasAudit = Array.prototype.slice.call(document.querySelectorAll("#auditoria tr"));
    var soNegadas = document.getElementById("so-negadas");
    var soSensiveis = document.getElementById("so-sensiveis");

    function filtrarAuditoria() {
      var termo = buscaAuditoria.value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      var visiveis = 0;

      linhasAudit.forEach(function (linha) {
        var texto = linha.textContent.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        var mostrar =
          (!termo || texto.indexOf(termo) > -1) &&
          (!soNegadas.checked || linha.dataset.outcome === "denied") &&
          (!soSensiveis.checked || linha.dataset.sensitive === "true");
        linha.hidden = !mostrar;
        if (mostrar) visiveis += 1;
      });

      document.getElementById("auditoria-status").textContent =
        visiveis === 1 ? "1 evento encontrado" : visiveis + " eventos encontrados";
    }

    buscaAuditoria.addEventListener("input", filtrarAuditoria);
    soNegadas.addEventListener("change", filtrarAuditoria);
    soSensiveis.addEventListener("change", filtrarAuditoria);
  }

  /* ------------------------------------------------------------ reiniciar -- */

  var reset = document.getElementById("qa-reset");
  if (reset) {
    reset.addEventListener("click", function () {
      store.reset(window.NERD_SEED || {});
      window.location.reload();
    });
  }
})();
