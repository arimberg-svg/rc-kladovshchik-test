const LETTERS = ["а", "б", "в", "г"];
const WEB3FORMS_KEY = "63b604c9-ac29-414f-bc13-31e194d0efc1";
const TO_EMAIL = "arimberg@gmail.com";
const WEB3_ENDPOINT = "https://api.web3forms.com/submit";
const FORMSUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${TO_EMAIL}`;
const PASS = 20;

let bank = [];
let questions = [];
let answers = [];
let current = 0;
let profile = { first_name: "", last_name: "", position: "", shift: "" };

const el = {
  start: document.getElementById("screen-start"),
  quiz: document.getElementById("screen-quiz"),
  result: document.getElementById("screen-result"),
  form: document.getElementById("start-form"),
  formError: document.getElementById("form-error"),
  prev: document.getElementById("btn-prev"),
  next: document.getElementById("btn-next"),
  restart: document.getElementById("btn-restart"),
  counter: document.getElementById("q-counter"),
  topic: document.getElementById("q-topic"),
  text: document.getElementById("q-text"),
  options: document.getElementById("options"),
  bar: document.getElementById("progress-bar"),
  scoreNum: document.getElementById("score-num"),
  scoreTotal: document.getElementById("score-total"),
  scorePercent: document.getElementById("score-percent"),
  scoreTitle: document.getElementById("score-title"),
  verdict: document.getElementById("score-verdict"),
  flagBanner: document.getElementById("flag-banner"),
  mailStatus: document.getElementById("mail-status"),
  summaryCards: document.getElementById("summary-cards"),
  topicStats: document.getElementById("topic-stats"),
  review: document.getElementById("review"),
};

function fullName() {
  return `${profile.first_name} ${profile.last_name}`.trim();
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function show(screen) {
  el.start.classList.toggle("hidden", screen !== "start");
  el.quiz.classList.toggle("hidden", screen !== "quiz");
  el.result.classList.toggle("hidden", screen !== "result");
}

function letterOf(optionText) {
  const m = String(optionText).trim().match(/^([абвг])\)/i);
  return m ? m[1].toLowerCase() : null;
}

function optionByLetter(q, letter) {
  if (!q.options || !letter) return "";
  const found = q.options.find((opt) => letterOf(opt) === String(letter).toLowerCase());
  return found || `${letter})`;
}

function hasAnswer() {
  return Boolean(answers[current]);
}

function syncNextState() {
  el.prev.disabled = current === 0;
  el.next.disabled = !hasAnswer();
  el.next.textContent = current === questions.length - 1 ? "Завершить" : "Далее";
}

function renderQuestion() {
  const q = questions[current];
  el.counter.textContent = `${current + 1} / ${questions.length}`;
  el.topic.textContent = q.topic;
  el.text.textContent = q.q;
  el.bar.style.width = `${((current + 1) / questions.length) * 100}%`;

  el.options.innerHTML = "";
  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option";
    btn.textContent = opt;
    const key = letterOf(opt) || LETTERS[idx];
    if (answers[current] === key) btn.classList.add("selected");
    btn.addEventListener("click", () => {
      answers[current] = key;
      [...el.options.children].forEach((c) => c.classList.remove("selected"));
      btn.classList.add("selected");
      syncNextState();
    });
    el.options.appendChild(btn);
  });

  syncNextState();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clip(text, max = 20000) {
  const s = String(text || "");
  return s.length <= max ? s : `${s.slice(0, max)}\n…(обрезано)`;
}

function buildReport(rows, correct, total, pct) {
  const wrongLines = rows
    .filter((r) => !r.ok)
    .map((r) => {
      return `#${r.i + 1} [${r.q.topic}] ошибка\nВопрос: ${r.q.q}\nВыбрано: ${optionByLetter(r.q, answers[r.i]) || "—"}\nВерно: ${optionByLetter(r.q, r.q.answer)}`;
    })
    .join("\n\n");

  const allAnswers = rows
    .map((r) => {
      const status = r.ok ? "верно" : "ошибка";
      return `#${r.i + 1} [${r.q.topic}] ${status}\n${r.q.q}\nОтвет сотрудника: ${optionByLetter(r.q, answers[r.i]) || "—"}\nЭталон: ${optionByLetter(r.q, r.q.answer)}`;
    })
    .join("\n\n");

  const topicLines = Object.entries(
    rows.reduce((acc, r) => {
      if (!acc[r.q.topic]) acc[r.q.topic] = { ok: 0, total: 0 };
      acc[r.q.topic].total += 1;
      if (r.ok) acc[r.q.topic].ok += 1;
      return acc;
    }, {})
  )
    .map(([t, s]) => `${t}: ${s.ok}/${s.total}`)
    .join("\n");

  const honestyFails = rows.filter((r) => r.q.flag === "honesty" && !r.ok);
  const fatigueFails = rows.filter((r) => r.q.flag === "fatigue" && !r.ok);
  const flagLines = [
    honestyFails.length
      ? `Честность — КРАСНЫЙ ФЛАГ (${honestyFails.length}): вопросы ${honestyFails.map((r) => r.i + 1).join(", ")}`
      : "Честность — без красного флага",
    fatigueFails.length
      ? `Усталость / срыв процесса (${fatigueFails.length}): вопросы ${fatigueFails.map((r) => r.i + 1).join(", ")}`
      : "Усталость — без срыва процесса",
  ].join("\n");

  const subject = `Тест кладовщика РЦ: ${fullName()} · ${profile.shift} · ${profile.position} · ${correct}/${total}`;
  const message = [
    "Результат теста «Кладовщик РЦ»",
    `Получатель: ${TO_EMAIL}`,
    "",
    `Имя: ${profile.first_name}`,
    `Фамилия: ${profile.last_name}`,
    `Должность: ${profile.position}`,
    `Смена: ${profile.shift}`,
    `Балл: ${correct}/${total} (${pct}%)`,
    `Норма: ${PASS} из ${total}`,
    "",
    "=== Флаги ===",
    flagLines,
    "",
    "=== По темам ===",
    topicLines,
    "",
    "=== Ошибки ===",
    wrongLines || "Ошибок нет",
    "",
    "=== Все ответы ===",
    allAnswers,
  ].join("\n");

  return {
    subject,
    message: clip(message, 50000),
    score: `${correct}/${total}`,
    pct,
    honestyFails,
    fatigueFails,
  };
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

async function sendResultEmail(report) {
  el.mailStatus.className = "mail-status";
  el.mailStatus.hidden = false;
  el.mailStatus.textContent = `Отправляем результат на ${TO_EMAIL}…`;

  const fields = {
    Имя: profile.first_name,
    Фамилия: profile.last_name,
    Должность: profile.position,
    Смена: profile.shift,
    Балл: report.score,
    Процент: `${report.pct}%`,
    Норма: `${PASS} из ${questions.length}`,
    Честность: report.honestyFails.length ? `КРАСНЫЙ ФЛАГ ×${report.honestyFails.length}` : "ок",
    Усталость: report.fatigueFails.length ? `срыв ×${report.fatigueFails.length}` : "ок",
  };

  const web3Payload = {
    access_key: WEB3FORMS_KEY,
    subject: report.subject,
    from_name: "Тест кладовщика РЦ",
    email: TO_EMAIL,
    ...fields,
    message: report.message,
  };

  const formsubmitPayload = {
    _subject: report.subject,
    _captcha: "false",
    _template: "box",
    name: fullName(),
    email: TO_EMAIL,
    ...fields,
    message: report.message,
  };

  const [primary, backup] = await Promise.allSettled([
    postJson(WEB3_ENDPOINT, web3Payload),
    postJson(FORMSUBMIT_ENDPOINT, formsubmitPayload),
  ]);

  const primaryOk = primary.status === "fulfilled";
  const backupOk = backup.status === "fulfilled";

  if (!primaryOk) console.warn("Web3Forms:", primary.reason);
  if (!backupOk) console.warn("FormSubmit:", backup.reason);

  if (primaryOk || backupOk) {
    el.mailStatus.className = "mail-status ok";
    el.mailStatus.textContent = `Результат отправлен на ${TO_EMAIL}.`;
    return;
  }

  const body = encodeURIComponent(report.message.slice(0, 1600));
  const subject = encodeURIComponent(report.subject);
  el.mailStatus.className = "mail-status bad";
  el.mailStatus.innerHTML =
    `Не удалось отправить автоматически. <a href="mailto:${TO_EMAIL}?subject=${subject}&body=${body}">Открыть письмо вручную</a>`;
}

function grade() {
  const byTopic = {};
  let correct = 0;

  const rows = questions.map((q, i) => {
    if (!byTopic[q.topic]) byTopic[q.topic] = { ok: 0, total: 0, wrong: [] };
    byTopic[q.topic].total += 1;
    const ok = answers[i] === q.answer;
    if (ok) {
      correct += 1;
      byTopic[q.topic].ok += 1;
    } else {
      byTopic[q.topic].wrong.push(i + 1);
    }
    return { q, i, ok };
  });

  const total = questions.length;
  const pct = Math.round((correct / total) * 100);
  const wrong = total - correct;
  const report = buildReport(rows, correct, total, pct);

  el.scoreNum.textContent = String(correct);
  el.scoreTotal.textContent = String(total);
  el.scorePercent.textContent = `${pct}% верных · ошибок: ${wrong}`;
  el.scoreTitle.textContent = `${fullName()}, ваш результат`;

  let verdict;
  if (correct >= PASS) verdict = "Зачёт. Регламент РЦ, упаковка и рамповые ситуации закрыты.";
  else if (correct >= PASS - 4) verdict = "Почти зачёт. Разберите ошибки ниже — обычно это маркировка, факт в ордере и паллет.";
  else if (correct >= PASS - 8) verdict = "Пока слабо. Пройдите ещё раз: приёмка, кросс-докинг, стрейч и что делать в конце смены.";
  else verdict = "Нужно повторно изучить регламент РЦ и пройти тест заново.";
  el.verdict.textContent = verdict;

  if (report.honestyFails.length) {
    el.flagBanner.classList.remove("hidden");
    el.flagBanner.textContent =
      `Красный флаг по честности (${report.honestyFails.length}). Даже при зачёте разберите с руководителем РЦ: излишек, факт в документах, хищение.`;
  } else if (report.fatigueFails.length) {
    el.flagBanner.classList.remove("hidden");
    el.flagBanner.textContent =
      `Срыв процесса на усталости (${report.fatigueFails.length}): в конце смены выбран «и так сойдёт». Имеет смысл разобрать на планёрке.`;
  } else {
    el.flagBanner.classList.add("hidden");
    el.flagBanner.textContent = "";
  }

  el.summaryCards.innerHTML = `
    <div class="summary-card ok"><span class="label">Верно</span><span class="value">${correct}</span></div>
    <div class="summary-card bad"><span class="label">Ошибки</span><span class="value">${wrong}</span></div>
    <div class="summary-card"><span class="label">Норма</span><span class="value">${PASS}/${total}</span></div>
    <div class="summary-card"><span class="label">${escapeHtml(profile.position)} · ${escapeHtml(profile.shift)}</span><span class="value">${pct}%</span></div>
  `;

  el.topicStats.innerHTML = Object.entries(byTopic)
    .sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total || a[0].localeCompare(b[0], "ru"))
    .map(([topic, s]) => {
      const pctTopic = Math.round((s.ok / s.total) * 100);
      const miss = s.wrong.length ? ` · № ${s.wrong.join(", ")}` : "";
      return `<div class="topic-row"><span>${escapeHtml(topic)}<br><span style="color:var(--muted);font-size:0.8rem">${pctTopic}%${miss}</span></span><strong>${s.ok}/${s.total}</strong></div>`;
    })
    .join("");

  el.review.innerHTML = [...rows]
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.i - b.i)
    .map((row) => {
      const yours = optionByLetter(row.q, answers[row.i]) || "—";
      const right = optionByLetter(row.q, row.q.answer);
      return `
        <div class="review-item ${row.ok ? "ok" : "bad"}">
          <div class="mark">${row.ok ? "Верно" : "Ошибка"} · вопрос ${row.i + 1}<span class="q-topic">${escapeHtml(row.q.topic)}</span></div>
          <div>${escapeHtml(row.q.q)}</div>
          <div class="opt-line"><strong>Ваш ответ:</strong> ${escapeHtml(yours)}</div>
          <div class="opt-line"><strong>Верный ответ:</strong> ${escapeHtml(right)}</div>
          <div class="sample"><strong>Пояснение:</strong> ${escapeHtml(row.q.explain || "")}</div>
        </div>`;
    })
    .join("");

  show("result");
  window.scrollTo({ top: 0, behavior: "smooth" });
  sendResultEmail(report);
}

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (el.form.elements.botcheck && el.form.elements.botcheck.checked) return;

  const first_name = el.form.elements.first_name.value.trim();
  const last_name = el.form.elements.last_name.value.trim();
  const position = el.form.elements.position.value.trim();
  const shift = el.form.elements.shift.value.trim();

  if (!first_name || !last_name || !position || !shift) {
    el.formError.classList.remove("hidden");
    return;
  }
  if (!bank.length) {
    el.formError.textContent = "Вопросы ещё загружаются — подождите секунду.";
    el.formError.classList.remove("hidden");
    return;
  }

  el.formError.classList.add("hidden");
  profile = { first_name, last_name, position, shift };
  questions = shuffle(bank);
  answers = Array(questions.length).fill(null);
  current = 0;
  show("quiz");
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

el.prev.addEventListener("click", () => {
  if (current > 0) {
    current -= 1;
    renderQuestion();
  }
});

el.next.addEventListener("click", () => {
  if (!hasAnswer()) return;
  if (current === questions.length - 1) grade();
  else {
    current += 1;
    renderQuestion();
  }
});

el.restart.addEventListener("click", () => {
  answers = Array(questions.length).fill(null);
  current = 0;
  show("start");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

bank = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
if (!bank.length) {
  el.formError.textContent = "Не удалось загрузить вопросы.";
  el.formError.classList.remove("hidden");
}
