/* Simulacija algoritama raspodjele procesa (CPU Scheduling Simulation)
   Podržani algoritmi: FCFS, SJF (neprekidajući), PRIORITY (neprekidajući), ROUND ROBIN
   Tip algoritma se uzima iz atributa <body data-cpu-algo="fcfs|sjf|priority|rr"> */

const PROC_COLORS = [
  "#2563eb", // P1 Blue
  "#059669", // P2 Emerald
  "#d97706", // P3 Amber
  "#7c3aed", // P4 Purple
  "#db2777", // P5 Pink
  "#0891b2", // P6 Cyan
  "#ea580c", // P7 Orange
  "#0d9488", // P8 Teal
  "#4f46e5", // P9 Indigo
  "#65a30d", // P10 Lime
  "#9333ea", // P11 Violet
  "#c026d3", // P12 Fuchsia
  "#e11d48", // P13 Rose
  "#ca8a04", // P14 Yellow
  "#16a34a"  // P15 Green
];

const PRESETS = {
  exam: {
    arrival: "0, 0, 0, 0, 0",
    burst: "10, 1, 2, 1, 5",
    priority: "3, 1, 3, 4, 2",
    quantum: "1"
  },
  staggered: {
    arrival: "0, 2, 4, 6, 8",
    burst: "2, 4, 6, 8, 10",
    priority: "3, 1, 4, 2, 5",
    quantum: "2"
  }
};

const CPU_DEFAULTS = PRESETS.exam;

const ALGO_BADGE = {
  fcfs: "FCFS",
  sjf: "SJF",
  priority: "PRIORITY",
  rr: "ROUND ROBIN"
};

let lastCpuResult = null;
let lastCpuInput = null;
let animTimer = null;
let animState = {
  active: false,
  paused: false,
  time: 0,
  maxTime: 0,
  speed: 1,
  result: null
};

/* ---------- Pomoćne funkcije ---------- */
function procColor(index) {
  return PROC_COLORS[index % PROC_COLORS.length];
}

function parseIntList(str, { min = 0 } = {}) {
  if (!str) return null;
  const parts = str.trim().split(/[\s,]+/).filter(s => s !== "");
  if (!parts.length) return null;
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isInteger(n) || isNaN(n) || n < min)) return null;
  return nums;
}

function parsePositiveInt(str) {
  const n = Number(String(str).trim());
  if (!Number.isInteger(n) || isNaN(n) || n <= 0) return null;
  return n;
}

function jobName(index) {
  return `P${index + 1}`;
}

function makeJobs(arrivals, bursts, priorities) {
  return arrivals.map((arrival, i) => ({
    id: i,
    name: jobName(i),
    color: procColor(i),
    arrival,
    burst: bursts[i],
    priority: priorities ? priorities[i] : null,
    remaining: bursts[i],
    finish: null,
    tat: null,
    wt: null
  }));
}

function finalizeJobs(jobs) {
  jobs.forEach(j => {
    j.tat = j.finish - j.arrival;
    j.wt = j.tat - j.burst;
  });
  return jobs;
}

function pushGantt(gantt, job, start, end) {
  if (end <= start) return;
  const last = gantt[gantt.length - 1];
  const name = job ? job.name : null;
  const id = job ? job.id : -1;
  const color = job ? job.color : null;

  if (last && last.name === name && last.end === start) {
    last.end = end;
    return;
  }
  gantt.push({ name, id, color, start, end });
}

function nextArrival(jobs, time) {
  const pending = jobs.filter(j => j.remaining > 0 && j.arrival > time);
  if (!pending.length) return null;
  return Math.min(...pending.map(j => j.arrival));
}

/* ---------- Algoritmi raspodjele procesa ---------- */

/* 1. FCFS (First Come First Served) */
function scheduleFcfs(jobs) {
  const gantt = [];
  const log = [];
  const order = [...jobs].sort((a, b) => a.arrival - b.arrival || a.id - b.id);
  let time = 0;

  order.forEach(job => {
    if (time < job.arrival) {
      log.push(`[t = ${time}]: CPU je slobodan (Idle) do dolaska ${job.name} u t = ${job.arrival}.`);
      pushGantt(gantt, null, time, job.arrival);
      time = job.arrival;
    }
    const start = time;
    const end = time + job.burst;
    log.push(`[t = ${start}]: Proces ${job.name} započinje izvršavanje (burst = ${job.burst}).`);
    pushGantt(gantt, job, start, end);
    time = end;
    job.remaining = 0;
    job.finish = time;
    log.push(`[t = ${time}]: Proces ${job.name} je završio. Vrijeme boravka (TAT) = ${job.finish - job.arrival}, Vrijeme čekanja (WT) = ${job.finish - job.arrival - job.burst}.`);
  });

  return { jobs: finalizeJobs(jobs), gantt, log };
}

/* 2. SJF (Shortest Job First - Neprekidajući) */
function scheduleSjf(jobs) {
  const gantt = [];
  const log = [];
  let time = 0;
  let done = 0;

  while (done < jobs.length) {
    const ready = jobs.filter(j => j.remaining > 0 && j.arrival <= time);
    if (!ready.length) {
      const nxt = nextArrival(jobs, time);
      if (nxt == null) break;
      log.push(`[t = ${time}]: Nema spremnih procesa. CPU je slobodan (Idle) do t = ${nxt}.`);
      pushGantt(gantt, null, time, nxt);
      time = nxt;
      continue;
    }

    ready.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival || a.id - b.id);
    const job = ready[0];
    const start = time;
    const end = time + job.burst;

    log.push(`[t = ${start}]: Među spremnim procesima [${ready.map(r => `${r.name}(burst:${r.burst})`).join(", ")}], odabran je ${job.name} s najkraćim burstom.`);
    pushGantt(gantt, job, start, end);
    time = end;
    job.remaining = 0;
    job.finish = time;
    done += 1;
    log.push(`[t = ${time}]: Proces ${job.name} je završio. TAT = ${job.finish - job.arrival}, WT = ${job.finish - job.arrival - job.burst}.`);
  }

  return { jobs: finalizeJobs(jobs), gantt, log };
}

/* 3. PRIORITY (Neprekidajući prioritet - manji broj = viši prioritet) */
function schedulePriority(jobs) {
  const gantt = [];
  const log = [];
  let time = 0;
  let done = 0;

  while (done < jobs.length) {
    const ready = jobs.filter(j => j.remaining > 0 && j.arrival <= time);
    if (!ready.length) {
      const nxt = nextArrival(jobs, time);
      if (nxt == null) break;
      log.push(`[t = ${time}]: Nema spremnih procesa. CPU je slobodan (Idle) do t = ${nxt}.`);
      pushGantt(gantt, null, time, nxt);
      time = nxt;
      continue;
    }

    ready.sort((a, b) => a.priority - b.priority || a.arrival - b.arrival || a.id - b.id);
    const job = ready[0];
    const start = time;
    const end = time + job.burst;

    log.push(`[t = ${start}]: Među spremnim procesima [${ready.map(r => `${r.name}(prioritet:${r.priority})`).join(", ")}], odabran je ${job.name} s najvišim prioritetom.`);
    pushGantt(gantt, job, start, end);
    time = end;
    job.remaining = 0;
    job.finish = time;
    done += 1;
    log.push(`[t = ${time}]: Proces ${job.name} je završio. TAT = ${job.finish - job.arrival}, WT = ${job.finish - job.arrival - job.burst}.`);
  }

  return { jobs: finalizeJobs(jobs), gantt, log };
}

/* 4. ROUND ROBIN (RR) */
function scheduleRr(jobs, quantum) {
  const gantt = [];
  const log = [];
  const queue = [];
  const inQueue = new Set();
  let time = 0;
  let done = 0;

  const addArrivedAt = t => {
    jobs
      .filter(j => j.remaining > 0 && j.arrival <= t && !inQueue.has(j.id))
      .sort((a, b) => a.arrival - b.arrival || a.id - b.id)
      .forEach(j => {
        queue.push(j);
        inQueue.add(j.id);
        log.push(`[t = ${t}]: Proces ${j.name} je stavljen u red čekanja.`);
      });
  };

  addArrivedAt(0);
  if (!queue.length) {
    const first = Math.min(...jobs.map(j => j.arrival));
    if (first > 0) {
      log.push(`[t = 0]: CPU je slobodan (Idle) do prve pojave procesa u t = ${first}.`);
      pushGantt(gantt, null, 0, first);
      time = first;
      addArrivedAt(time);
    }
  }

  while (done < jobs.length) {
    if (!queue.length) {
      const nxt = nextArrival(jobs, time);
      if (nxt == null) break;
      log.push(`[t = ${time}]: Red je prazan. CPU čeka do t = ${nxt}.`);
      pushGantt(gantt, null, time, nxt);
      time = nxt;
      addArrivedAt(time);
      continue;
    }

    const job = queue.shift();
    inQueue.delete(job.id);
    const slice = Math.min(quantum, job.remaining);
    const start = time;
    const end = time + slice;

    log.push(`[t = ${start}]: Proces ${job.name} se izvršava (kvant = ${slice}, preostalo = ${job.remaining - slice}).`);
    pushGantt(gantt, job, start, end);
    job.remaining -= slice;
    time = end;

    addArrivedAt(time);

    if (job.remaining > 0) {
      queue.push(job);
      inQueue.add(job.id);
      log.push(`[t = ${time}]: Kvant je istekao. Proces ${job.name} se vraća na kraj reda čekanja.`);
    } else {
      job.finish = time;
      done += 1;
      log.push(`[t = ${time}]: Proces ${job.name} je uspješno završio! TAT = ${job.finish - job.arrival}, WT = ${job.finish - job.arrival - job.burst}.`);
    }
  }

  return { jobs: finalizeJobs(jobs), gantt, log, quantum };
}

/* Izvršavanje simulacije */
function runCpuSimulation(algo, arrivals, bursts, extras = {}) {
  const jobs = makeJobs(arrivals, bursts, extras.priorities);
  if (algo === "fcfs") return { algo, ...scheduleFcfs(jobs) };
  if (algo === "sjf") return { algo, ...scheduleSjf(jobs) };
  if (algo === "priority") return { algo, ...schedulePriority(jobs) };
  return { algo, ...scheduleRr(jobs, extras.quantum || 1) };
}

/* Izvršavanje svih algoritama radi poređenja */
function runAllAlgorithms(arrivals, bursts, priorities, quantum) {
  const pList = priorities && priorities.length === arrivals.length ? priorities : arrivals.map((_, i) => i + 1);
  const qVal = quantum || 1;

  const resFcfs = runCpuSimulation("fcfs", arrivals, bursts, {});
  const resRr = runCpuSimulation("rr", arrivals, bursts, { quantum: qVal });
  const resSjf = runCpuSimulation("sjf", arrivals, bursts, {});
  const resPriority = runCpuSimulation("priority", arrivals, bursts, { priorities: pList });

  const algos = [
    { key: "fcfs", name: "FCFS", res: resFcfs },
    { key: "rr", name: `RR (Q = ${qVal})`, res: resRr },
    { key: "sjf", name: "SJF", res: resSjf },
    { key: "priority", name: "Prioritetno", res: resPriority }
  ];

  algos.forEach(a => {
    const jobs = a.res.jobs;
    a.avgTat = jobs.reduce((s, j) => s + j.tat, 0) / jobs.length;
    a.avgWt = jobs.reduce((s, j) => s + j.wt, 0) / jobs.length;
  });

  let best = algos[0];
  algos.forEach(a => {
    if (a.avgWt < best.avgWt) best = a;
  });

  return { algos, best, jobsCount: arrivals.length };
}

/* ---------- Prikaz rezultata ---------- */

function formatAverage(sum, n) {
  const avg = sum / n;
  const shown = Number.isInteger(avg) ? String(avg) : avg.toFixed(2);
  return `${sum} / ${n} = ${shown}`;
}

function renderSummaryCards(result) {
  const jobs = result.jobs;
  const n = jobs.length;
  const tatSum = jobs.reduce((s, j) => s + j.tat, 0);
  const wtSum = jobs.reduce((s, j) => s + j.wt, 0);
  const avgTat = (tatSum / n).toFixed(2);
  const avgWt = (wtSum / n).toFixed(2);

  const totalTime = result.gantt.length ? result.gantt[result.gantt.length - 1].end : 0;
  const idleTime = result.gantt.filter(g => g.name == null).reduce((s, g) => s + (g.end - g.start), 0);
  const busyTime = totalTime - idleTime;
  const cpuUtil = totalTime > 0 ? ((busyTime / totalTime) * 100).toFixed(1) : "0";

  document.getElementById("summary-cards").innerHTML = `
    <div class="stat-card">
      <div class="stat-val">${avgWt} <small style="font-size:0.9rem">ms</small></div>
      <div class="stat-label" data-i18n="metric.awt">${t("metric.awt")}</div>
      <div class="stat-sub">${wtSum} / ${n}</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${avgTat} <small style="font-size:0.9rem">ms</small></div>
      <div class="stat-label" data-i18n="metric.atat">${t("metric.atat")}</div>
      <div class="stat-sub">${tatSum} / ${n}</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${totalTime} <small style="font-size:0.9rem">ms</small></div>
      <div class="stat-label" data-i18n="metric.makespan">${t("metric.makespan")}</div>
      <div class="stat-sub">Makespan</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${cpuUtil}%</div>
      <div class="stat-label" data-i18n="metric.cpuUtil">${t("metric.cpuUtil")}</div>
      <div class="stat-sub">${busyTime} / ${totalTime} ms</div>
    </div>
  `;
}

function renderTable(result) {
  const showPriority = result.algo === "priority";
  const jobs = result.jobs;
  const n = jobs.length;
  const tatSum = jobs.reduce((s, j) => s + j.tat, 0);
  const wtSum = jobs.reduce((s, j) => s + j.wt, 0);

  const head = `
    <thead>
      <tr>
        <th>${t("col.job")}</th>
        <th>${t("col.arrival")}</th>
        <th>${t("col.burst")}</th>
        ${showPriority ? `<th>${t("col.priority")}</th>` : ""}
        <th>${t("col.finish")}</th>
        <th>${t("col.tat")}</th>
        <th>${t("col.wt")}</th>
      </tr>
    </thead>`;

  const body = jobs.map(j => `
    <tr id="row-job-${j.id}">
      <td><span class="proc-badge" style="background:${j.color}">${j.name}</span></td>
      <td>${j.arrival}</td>
      <td>${j.burst}</td>
      ${showPriority ? `<td>${j.priority}</td>` : ""}
      <td><b>${j.finish}</b></td>
      <td>${j.tat}</td>
      <td><b>${j.wt}</b></td>
    </tr>`).join("");

  const span = showPriority ? 5 : 4;
  const foot = `
    <tfoot>
      <tr>
        <td colspan="${span}" class="avg-label">${t("col.average")}</td>
        <td>${formatAverage(tatSum, n)}</td>
        <td>${formatAverage(wtSum, n)}</td>
      </tr>
    </tfoot>`;

  document.getElementById("result-table").innerHTML =
    `<table class="result-table">${head}<tbody>${body}</tbody>${foot}</table>`;
}

function renderGanttStructure(result) {
  const { gantt } = result;
  const host = document.getElementById("gantt");
  if (!gantt.length) {
    host.innerHTML = `<div class="empty">${t("empty.clickStart")}</div>`;
    return;
  }

  const cells = gantt.map((seg, i) => {
    const dur = seg.end - seg.start;
    const isIdle = seg.name == null;
    const label = isIdle ? t("gantt.idle") : seg.name;
    const idleClass = isIdle ? " is-idle" : "";
    const styleBg = isIdle ? "" : `background:${seg.color};`;

    return `<div class="gantt-cell${idleClass}" id="gantt-cell-${i}" style="flex:${dur}; ${styleBg}" title="${label} [${seg.start} - ${seg.end}] (Trajanje: ${dur})">${label}</div>`;
  }).join("");

  const times = gantt.map((seg, i) => {
    const dur = seg.end - seg.start;
    const startMark = i === 0 ? `<span class="gantt-time is-start">0</span>` : "";
    return `<div class="gantt-tick" style="flex:${dur}">
      ${startMark}
      <span class="gantt-time is-end">${seg.end}</span>
    </div>`;
  }).join("");

  host.innerHTML = `
    <div class="gantt-chart">
      <div class="gantt-cells">${cells}</div>
      <div class="gantt-axis">${times}</div>
      <div class="gantt-playhead" id="gantt-playhead" style="left: 0%;"></div>
    </div>`;
}

function renderExecutionLog(result) {
  const logEl = document.getElementById("log");
  if (!logEl) return;
  if (!result.log || !result.log.length) {
    logEl.innerHTML = `<li>${t("empty.clickStart")}</li>`;
    return;
  }
  logEl.innerHTML = result.log.map(item => `<li>${item}</li>`).join("");
}

function renderProcessPreview(arrivals, bursts, priorities) {
  const preview = document.getElementById("proc-chips");
  if (!preview) return;
  if (!arrivals || !bursts || arrivals.length !== bursts.length) {
    preview.innerHTML = `<span style="color:var(--text-subtle); font-size:0.85rem;">(Unesite jednake dužine arrival i burst vremena)</span>`;
    return;
  }

  preview.innerHTML = arrivals.map((arr, i) => {
    const name = jobName(i);
    const color = procColor(i);
    const burst = bursts[i];
    const prio = priorities && priorities[i] != null ? ` | Prio: ${priorities[i]}` : "";
    return `<span class="proc-chip">
      <span class="proc-color-dot" style="background:${color}"></span>
      <b>${name}</b> (AT: ${arr}, BT: ${burst}${prio})
    </span>`;
  }).join("");
}

function renderComparisonSection(arrivals, bursts, priorities, quantum) {
  const comp = runAllAlgorithms(arrivals, bursts, priorities, quantum);
  const content = document.getElementById("comparison-content");
  if (!content) return;

  const n = comp.jobsCount;
  const bestName = comp.best.name;
  const bestVal = comp.best.avgWt.toFixed(2);

  // Table (b) Completion times
  let completionHead = `<thead><tr><th>Proces</th>`;
  comp.algos.forEach(a => completionHead += `<th>${a.name}</th>`);
  completionHead += `</tr></thead>`;

  let completionBody = "";
  for (let i = 0; i < n; i++) {
    completionBody += `<tr><td><b>${jobName(i)}</b></td>`;
    comp.algos.forEach(a => {
      const j = a.res.jobs[i];
      completionBody += `<td>${j ? j.finish : "-"}</td>`;
    });
    completionBody += `</tr>`;
  }

  // Table (c) Waiting times
  let waitingHead = `<thead><tr><th>Proces</th>`;
  comp.algos.forEach(a => waitingHead += `<th>${a.name}</th>`);
  waitingHead += `</tr></thead>`;

  let waitingBody = "";
  for (let i = 0; i < n; i++) {
    waitingBody += `<tr><td><b>${jobName(i)}</b></td>`;
    comp.algos.forEach(a => {
      const j = a.res.jobs[i];
      waitingBody += `<td>${j ? j.wt : "-"}</td>`;
    });
    waitingBody += `</tr>`;
  }

  let waitingFoot = `<tfoot><tr><td><b>${t("compare.avgRow")}</b></td>`;
  comp.algos.forEach(a => {
    const isBest = a.key === comp.best.key;
    const style = isBest ? "color:var(--accent); font-weight:700;" : "";
    waitingFoot += `<td style="${style}">${a.avgWt.toFixed(2)}</td>`;
  });
  waitingFoot += `</tr></tfoot>`;

  content.innerHTML = `
    <div class="best-algo-box">
      <span class="best-algo-icon">🏆</span>
      <div>
        <strong>${t("compare.best", { algo: bestName, val: bestVal + " ms" })}</strong>
      </div>
    </div>
    <div class="compare-tables-grid">
      <div>
        <h4 style="margin: 0 0 10px; font-size:1rem; font-weight:600;">(b) ${t("compare.completionTitle")}</h4>
        <div class="table-wrap">
          <table class="result-table">
            ${completionHead}
            <tbody>${completionBody}</tbody>
          </table>
        </div>
      </div>
      <div>
        <h4 style="margin: 0 0 10px; font-size:1rem; font-weight:600;">(c) ${t("compare.waitingTitle")}</h4>
        <div class="table-wrap">
          <table class="result-table">
            ${waitingHead}
            <tbody>${waitingBody}</tbody>
            ${waitingFoot}
          </table>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Animacija Ganttovog dijagrama ---------- */

function stopAnimation() {
  if (animTimer) {
    clearInterval(animTimer);
    animTimer = null;
  }
  animState.active = false;
  animState.paused = false;
}

function updatePlayButton(isPlaying) {
  const icon = document.getElementById("anim-play-icon");
  const text = document.getElementById("anim-play-text");
  if (icon && text) {
    icon.textContent = isPlaying ? "⏸" : "▶";
    text.textContent = isPlaying ? t("anim.pause") : t("anim.play");
  }
}

function stepAnimationTo(time, result) {
  const { gantt } = result;
  if (!gantt.length) return;
  const total = gantt[gantt.length - 1].end;

  const playhead = document.getElementById("gantt-playhead");
  const timeBadge = document.getElementById("anim-time-badge");
  const statusText = document.getElementById("anim-status-text");

  const pct = total > 0 ? Math.min(100, Math.max(0, (time / total) * 100)) : 0;
  if (playhead) playhead.style.left = `${pct}%`;
  if (timeBadge) timeBadge.textContent = `t = ${time}`;

  // Find active segment
  let activeSeg = null;
  gantt.forEach((seg, i) => {
    const cell = document.getElementById(`gantt-cell-${i}`);
    if (!cell) return;

    if (time >= seg.start && time < seg.end) {
      cell.classList.add("is-active-step");
      cell.style.opacity = "1";
      activeSeg = seg;
    } else if (time >= seg.end) {
      cell.classList.remove("is-active-step");
      cell.style.opacity = "1";
    } else {
      cell.classList.remove("is-active-step");
      cell.style.opacity = "0.35";
    }
  });

  // Highlight corresponding row in results table
  document.querySelectorAll(".result-table tbody tr").forEach(tr => tr.classList.remove("is-executing"));
  if (activeSeg && activeSeg.id >= 0) {
    const row = document.getElementById(`row-job-${activeSeg.id}`);
    if (row) row.classList.add("is-executing");
  }

  // Update status message
  if (statusText) {
    if (time >= total) {
      statusText.textContent = t("anim.status.done", { t: total });
    } else if (activeSeg) {
      if (activeSeg.name == null) {
        statusText.textContent = t("anim.status.idle");
      } else {
        statusText.textContent = t("anim.status.running", { job: activeSeg.name, t: time });
      }
    } else {
      statusText.textContent = t("anim.status.ready");
    }
  }
}

function showFullGantt(result) {
  stopAnimation();
  updatePlayButton(false);
  const total = result.gantt.length ? result.gantt[result.gantt.length - 1].end : 0;
  animState.time = total;
  stepAnimationTo(total, result);

  // Restore opacity of all cells
  result.gantt.forEach((_, i) => {
    const cell = document.getElementById(`gantt-cell-${i}`);
    if (cell) {
      cell.style.opacity = "1";
      cell.classList.remove("is-active-step");
    }
  });
  document.querySelectorAll(".result-table tbody tr").forEach(tr => tr.classList.remove("is-executing"));
}

function startGanttAnimation(result) {
  stopAnimation();
  if (!result || !result.gantt.length) return;

  const total = result.gantt[result.gantt.length - 1].end;
  animState.active = true;
  animState.paused = false;
  animState.time = 0;
  animState.maxTime = total;
  animState.result = result;
  updatePlayButton(true);

  stepAnimationTo(0, result);

  const baseInterval = 600; // ms per time unit at 1x
  const tickInterval = () => Math.max(80, baseInterval / animState.speed);

  const loop = () => {
    if (!animState.active || animState.paused) return;

    if (animState.time < animState.maxTime) {
      animState.time += 1;
      stepAnimationTo(animState.time, result);
      animTimer = setTimeout(loop, tickInterval());
    } else {
      stopAnimation();
      updatePlayButton(false);
      showFullGantt(result);
    }
  };

  animTimer = setTimeout(loop, tickInterval());
}

function toggleGanttAnimation() {
  if (!animState.result) return;

  if (!animState.active) {
    // Start or restart
    startGanttAnimation(animState.result);
  } else if (animState.paused) {
    // Resume
    animState.paused = false;
    updatePlayButton(true);
    const baseInterval = 600;
    const tickInterval = () => Math.max(80, baseInterval / animState.speed);

    const loop = () => {
      if (!animState.active || animState.paused) return;
      if (animState.time < animState.maxTime) {
        animState.time += 1;
        stepAnimationTo(animState.time, animState.result);
        animTimer = setTimeout(loop, tickInterval());
      } else {
        stopAnimation();
        updatePlayButton(false);
        showFullGantt(animState.result);
      }
    };
    animTimer = setTimeout(loop, tickInterval());
  } else {
    // Pause
    animState.paused = true;
    clearTimeout(animTimer);
    animTimer = null;
    updatePlayButton(false);
    const statusText = document.getElementById("anim-status-text");
    if (statusText) statusText.textContent = `⏸ ${t("anim.pause")} (t = ${animState.time})`;
  }
}

/* ---------- Inicijalizacija i upravljanje formom ---------- */

function readInputs(algo) {
  const arrivals = parseIntList(document.getElementById("arrival-input").value, { min: 0 });
  const bursts = parseIntList(document.getElementById("burst-input").value, { min: 1 });
  const extras = {};

  if (!arrivals || !bursts) {
    return { error: t("error.invalidCpuInput") };
  }
  if (arrivals.length !== bursts.length) {
    return { error: t("error.lengthMismatch") };
  }

  if (algo === "priority") {
    const priorities = parseIntList(document.getElementById("priority-input").value, { min: 0 });
    if (!priorities) return { error: t("error.invalidPriority") };
    if (priorities.length !== arrivals.length) return { error: t("error.lengthMismatch") };
    extras.priorities = priorities;
  }

  if (algo === "rr") {
    const quantum = parsePositiveInt(document.getElementById("quantum-input").value);
    if (quantum == null) return { error: t("error.invalidQuantum") };
    extras.quantum = quantum;
  }

  return { arrivals, bursts, extras };
}

function renderCpu(result, parsed) {
  const badge = document.getElementById("algo-badge");
  if (badge) badge.textContent = ALGO_BADGE[result.algo] || result.algo.toUpperCase();

  renderSummaryCards(result);
  renderGanttStructure(result);
  renderTable(result);
  renderExecutionLog(result);

  // Render comparison tables
  const priorities = parsed.extras && parsed.extras.priorities ? parsed.extras.priorities : null;
  const quantum = parsed.extras && parsed.extras.quantum ? parsed.extras.quantum : 1;
  renderComparisonSection(parsed.arrivals, parsed.bursts, priorities, quantum);

  const results = document.getElementById("results");
  results.style.display = "block";

  // Start animated Gantt
  startGanttAnimation(result);
}

function clearCpuResults() {
  stopAnimation();
  lastCpuResult = null;
  const results = document.getElementById("results");
  if (results) results.style.display = "none";
  const gantt = document.getElementById("gantt");
  if (gantt) gantt.innerHTML = "";
  const table = document.getElementById("result-table");
  if (table) table.innerHTML = "";
  const log = document.getElementById("log");
  if (log) log.innerHTML = "";
  const comp = document.getElementById("comparison-content");
  if (comp) comp.style.display = "none";
}

function applyPreset(presetKey, algo) {
  const p = PRESETS[presetKey];
  if (!p) return;

  const arrivalInput = document.getElementById("arrival-input");
  const burstInput = document.getElementById("burst-input");
  const priorityInput = document.getElementById("priority-input");
  const quantumInput = document.getElementById("quantum-input");

  if (arrivalInput) arrivalInput.value = p.arrival;
  if (burstInput) burstInput.value = p.burst;
  if (priorityInput) priorityInput.value = p.priority;
  if (quantumInput) quantumInput.value = p.quantum;

  const parsed = readInputs(algo);
  if (!parsed.error) {
    renderProcessPreview(parsed.arrivals, parsed.bursts, parsed.extras.priorities);
  }
}

function initCpuPage() {
  const algo = document.body.dataset.cpuAlgo;
  if (!algo) return;

  const arrivalInput = document.getElementById("arrival-input");
  const burstInput = document.getElementById("burst-input");
  const priorityInput = document.getElementById("priority-input");
  const quantumInput = document.getElementById("quantum-input");
  const error = document.getElementById("error");

  // Initial defaults
  arrivalInput.value = CPU_DEFAULTS.arrival;
  burstInput.value = CPU_DEFAULTS.burst;
  if (priorityInput) priorityInput.value = CPU_DEFAULTS.priority;
  if (quantumInput) quantumInput.value = CPU_DEFAULTS.quantum;

  // Live preview setup
  const updatePreview = () => {
    const arrivals = parseIntList(arrivalInput.value, { min: 0 });
    const bursts = parseIntList(burstInput.value, { min: 1 });
    const prios = priorityInput ? parseIntList(priorityInput.value, { min: 0 }) : null;
    renderProcessPreview(arrivals, bursts, prios);
  };

  arrivalInput.addEventListener("input", updatePreview);
  burstInput.addEventListener("input", updatePreview);
  if (priorityInput) priorityInput.addEventListener("input", updatePreview);
  updatePreview();

  // Presets
  const btnPresetExam = document.getElementById("preset-exam");
  if (btnPresetExam) {
    btnPresetExam.addEventListener("click", () => {
      applyPreset("exam", algo);
    });
  }
  const btnPresetStaggered = document.getElementById("preset-staggered");
  if (btnPresetStaggered) {
    btnPresetStaggered.addEventListener("click", () => {
      applyPreset("staggered", algo);
    });
  }

  // Animation controls
  const playBtn = document.getElementById("anim-play-btn");
  if (playBtn) playBtn.addEventListener("click", toggleGanttAnimation);

  const replayBtn = document.getElementById("anim-replay-btn");
  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      if (lastCpuResult) startGanttAnimation(lastCpuResult);
    });
  }

  const speedSelect = document.getElementById("anim-speed");
  if (speedSelect) {
    speedSelect.addEventListener("change", e => {
      animState.speed = Number(e.target.value) || 1;
    });
  }

  const skipBtn = document.getElementById("anim-skip-btn");
  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      if (lastCpuResult) showFullGantt(lastCpuResult);
    });
  }

  // Toggle comparison
  const toggleCompBtn = document.getElementById("toggle-compare-btn");
  const compContent = document.getElementById("comparison-content");
  if (toggleCompBtn && compContent) {
    toggleCompBtn.addEventListener("click", () => {
      const isHidden = compContent.style.display === "none";
      compContent.style.display = isHidden ? "block" : "none";
      toggleCompBtn.textContent = isHidden ? t("compare.hide") : t("compare.show");
    });
  }

  // Simulation controls
  document.getElementById("start").addEventListener("click", () => {
    const parsed = readInputs(algo);
    if (parsed.error) {
      error.textContent = parsed.error;
      return;
    }
    error.textContent = "";
    lastCpuInput = parsed;
    lastCpuResult = runCpuSimulation(algo, parsed.arrivals, parsed.bursts, parsed.extras);
    renderCpu(lastCpuResult, parsed);
  });

  document.getElementById("reset").addEventListener("click", () => {
    arrivalInput.value = CPU_DEFAULTS.arrival;
    burstInput.value = CPU_DEFAULTS.burst;
    if (priorityInput) priorityInput.value = CPU_DEFAULTS.priority;
    if (quantumInput) quantumInput.value = CPU_DEFAULTS.quantum;
    error.textContent = "";
    updatePreview();
    clearCpuResults();
  });

  window.onLanguageChange = () => {
    if (lastCpuResult && lastCpuInput) {
      lastCpuResult = runCpuSimulation(algo, lastCpuInput.arrivals, lastCpuInput.bursts, lastCpuInput.extras);
      renderCpu(lastCpuResult, lastCpuInput);
    }
    updatePreview();
  };
}

document.addEventListener("DOMContentLoaded", initCpuPage);
