/* Simulacija algoritama zamjene stranica (Page Replacement Simulation)
   Podržani algoritmi: OPT (Optimalni), LRU, FIFO, NFU, Second Chance, Clock
   Referenca: Vježba 3 - Upravljanje memorijom - Algoritmi
   Tip algoritma se uzima iz atributa <body data-paging-algo="opt|lru|fifo|nfu|second_chance|clock"> */

const PAGING_PRESETS = {
  p1: {
    ref: "B, C, B, A, E, F, B, D, F, E, C, B, E",
    frames: 4,
    time: "1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13"
  }
};

const PAGING_DEFAULTS = PAGING_PRESETS.p1;

const PAGING_BADGES = {
  opt: "OPTIMALNI (OPT)",
  lru: "LRU",
  fifo: "FIFO",
  nfu: "NFU",
  second_chance: "SECOND CHANCE",
  clock: "CLOCK REPLACEMENT"
};

let lastPagingResult = null;
let lastPagingInput = null;
let pagingAnimTimer = null;
let pagingAnimState = {
  active: false,
  paused: false,
  currentStep: 0,
  totalSteps: 0,
  speed: 1,
  result: null
};

/* ---------- Pomoćne funkcije ---------- */

function parseReferenceList(str) {
  if (!str) return null;
  const parts = str.trim().split(/[\s,]+/).filter(s => s !== "");
  if (!parts.length) return null;
  return parts;
}

function parseTimeList(str, count) {
  if (!str || !str.trim()) {
    return Array.from({ length: count }, (_, i) => String(i + 1));
  }
  const parts = str.trim().split(/[\s,]+/).filter(s => s !== "");
  if (parts.length === count) return parts;
  return Array.from({ length: count }, (_, i) => parts[i] || String(i + 1));
}

/* ---------- Algoritmi zamjene stranica ---------- */

/* 1. OPTIMALNI (OPT / MIN) */
function runOpt(refList, frameCount, timeList, lookaheadSteps = null) {
  const steps = [];
  const frames = Array(frameCount).fill(null);
  const loadedAt = Array(frameCount).fill(0);
  let faults = 0;
  let hits = 0;
  const isLookahead = Number.isInteger(lookaheadSteps) && lookaheadSteps > 0;

  refList.forEach((page, stepIdx) => {
    const existingIndex = frames.indexOf(page);
    let isHit = false;
    let replacedFrame = -1;
    let evictedPage = null;
    let decisionNote = null;

    if (existingIndex !== -1) {
      isHit = true;
      hits++;
    } else {
      faults++;
      const emptyIndex = frames.indexOf(null);
      if (emptyIndex !== -1) {
        frames[emptyIndex] = page;
        loadedAt[emptyIndex] = stepIdx;
        replacedFrame = emptyIndex;
      } else {
        // Look into future (either full or bounded by lookaheadSteps)
        let furthestDist = -1;
        let victimIndex = 0;
        const endK = isLookahead ? Math.min(refList.length, stepIdx + 1 + lookaheadSteps) : refList.length;

        frames.forEach((fPage, fIdx) => {
          let nextUse = Infinity;
          for (let k = stepIdx + 1; k < endK; k++) {
            if (refList[k] === fPage) {
              nextUse = k;
              break;
            }
          }
          if (nextUse > furthestDist) {
            furthestDist = nextUse;
            victimIndex = fIdx;
          } else if (nextUse === furthestDist) {
            // Tie-break: FIFO (loaded earlier)
            if (loadedAt[fIdx] < loadedAt[victimIndex]) {
              victimIndex = fIdx;
            }
          }
        });

        evictedPage = frames[victimIndex];
        frames[victimIndex] = page;
        loadedAt[victimIndex] = stepIdx;
        replacedFrame = victimIndex;

        if (isLookahead) {
          if (furthestDist === Infinity) {
            decisionNote = t("log.lookaheadNotSeen", {
              page: evictedPage,
              steps: lookaheadSteps
            });
          } else {
            const dist = furthestDist - stepIdx;
            decisionNote = t("log.lookaheadFurthest", {
              page: evictedPage,
              dist: dist,
              steps: lookaheadSteps
            });
          }
        } else {
          if (furthestDist === Infinity) {
            decisionNote = t("log.optNeverUsed", { page: evictedPage });
          } else {
            const dist = furthestDist - stepIdx;
            decisionNote = t("log.optFurthest", { page: evictedPage, dist: dist });
          }
        }
      }
    }

    steps.push({
      time: timeList[stepIdx] || stepIdx + 1,
      page,
      frames: [...frames],
      isHit,
      replacedFrame,
      evictedPage,
      decisionNote,
      status: isHit ? "hit" : "fault"
    });
  });

  return {
    algo: "opt",
    refList,
    frameCount,
    steps,
    faults,
    hits,
    lookahead: isLookahead ? lookaheadSteps : null
  };
}

/* 2. LRU (The Least Recently Used) */
function runLru(refList, frameCount, timeList) {
  const steps = [];
  const frames = Array(frameCount).fill(null);
  const lastUsed = Array(frameCount).fill(-1);
  let faults = 0;
  let hits = 0;

  refList.forEach((page, t) => {
    const existingIndex = frames.indexOf(page);
    let isHit = false;
    let replacedFrame = -1;
    let evictedPage = null;

    if (existingIndex !== -1) {
      isHit = true;
      hits++;
      lastUsed[existingIndex] = t;
    } else {
      faults++;
      const emptyIndex = frames.indexOf(null);
      if (emptyIndex !== -1) {
        frames[emptyIndex] = page;
        lastUsed[emptyIndex] = t;
        replacedFrame = emptyIndex;
      } else {
        let minUsed = Infinity;
        let victimIndex = 0;

        frames.forEach((_, fIdx) => {
          if (lastUsed[fIdx] < minUsed) {
            minUsed = lastUsed[fIdx];
            victimIndex = fIdx;
          }
        });

        evictedPage = frames[victimIndex];
        frames[victimIndex] = page;
        lastUsed[victimIndex] = t;
        replacedFrame = victimIndex;
      }
    }

    // Determine candidate for replacement at this step (the one with lowest lastUsed)
    let candidateIndex = -1;
    let minT = Infinity;
    frames.forEach((f, idx) => {
      if (f !== null && lastUsed[idx] < minT) {
        minT = lastUsed[idx];
        candidateIndex = idx;
      }
    });

    steps.push({
      time: timeList[t] || t + 1,
      page,
      frames: [...frames],
      isHit,
      replacedFrame,
      evictedPage,
      candidateIndex,
      status: isHit ? "hit" : "fault"
    });
  });

  return { algo: "lru", refList, frameCount, steps, faults, hits };
}

/* 3. FIFO (First In, First Out) */
function runFifo(refList, frameCount, timeList) {
  const steps = [];
  const frames = Array(frameCount).fill(null);
  const loadedAt = Array(frameCount).fill(-1);
  let faults = 0;
  let hits = 0;
  let counter = 0;

  refList.forEach((page, t) => {
    const existingIndex = frames.indexOf(page);
    let isHit = false;
    let replacedFrame = -1;
    let evictedPage = null;

    if (existingIndex !== -1) {
      isHit = true;
      hits++;
    } else {
      faults++;
      const emptyIndex = frames.indexOf(null);
      if (emptyIndex !== -1) {
        frames[emptyIndex] = page;
        loadedAt[emptyIndex] = counter++;
        replacedFrame = emptyIndex;
      } else {
        let minLoaded = Infinity;
        let victimIndex = 0;
        frames.forEach((_, fIdx) => {
          if (loadedAt[fIdx] < minLoaded) {
            minLoaded = loadedAt[fIdx];
            victimIndex = fIdx;
          }
        });

        evictedPage = frames[victimIndex];
        frames[victimIndex] = page;
        loadedAt[victimIndex] = counter++;
        replacedFrame = victimIndex;
      }
    }

    steps.push({
      time: timeList[t] || t + 1,
      page,
      frames: [...frames],
      isHit,
      replacedFrame,
      evictedPage,
      status: isHit ? "hit" : "fault"
    });
  });

  return { algo: "fifo", refList, frameCount, steps, faults, hits };
}

/* 4. NFU (Not Frequently Used) */
function runNfu(refList, frameCount, timeList) {
  const steps = [];
  const frames = Array(frameCount).fill(null);
  const counters = Array(frameCount).fill(0);
  const loadedAt = Array(frameCount).fill(-1);
  let faults = 0;
  let hits = 0;
  let timeSeq = 0;

  refList.forEach((page, t) => {
    const existingIndex = frames.indexOf(page);
    let isHit = false;
    let replacedFrame = -1;
    let evictedPage = null;

    if (existingIndex !== -1) {
      isHit = true;
      hits++;
      counters[existingIndex] += 1;
    } else {
      faults++;
      const emptyIndex = frames.indexOf(null);
      if (emptyIndex !== -1) {
        frames[emptyIndex] = page;
        counters[emptyIndex] = 0;
        loadedAt[emptyIndex] = timeSeq++;
        replacedFrame = emptyIndex;
      } else {
        let minCount = Infinity;
        let victimIndex = 0;

        frames.forEach((_, fIdx) => {
          if (counters[fIdx] < minCount) {
            minCount = counters[fIdx];
            victimIndex = fIdx;
          } else if (counters[fIdx] === minCount) {
            // Tie-break: FIFO
            if (loadedAt[fIdx] < loadedAt[victimIndex]) {
              victimIndex = fIdx;
            }
          }
        });

        evictedPage = frames[victimIndex];
        frames[victimIndex] = page;
        counters[victimIndex] = 0;
        loadedAt[victimIndex] = timeSeq++;
        replacedFrame = victimIndex;
      }
    }

    steps.push({
      time: timeList[t] || t + 1,
      page,
      frames: [...frames],
      counters: [...counters],
      isHit,
      replacedFrame,
      evictedPage,
      status: isHit ? "hit" : "fault"
    });
  });

  return { algo: "nfu", refList, frameCount, steps, faults, hits };
}

/* 5. SECOND CHANCE (Druga šansa) */
function runSecondChance(refList, frameCount, timeList) {
  const steps = [];
  const frames = Array(frameCount).fill(null);
  const bits = Array(frameCount).fill(0);
  // Queue stores frame indices in FIFO arrival order
  const queue = [];
  let faults = 0;
  let hits = 0;

  refList.forEach((page, t) => {
    const existingIndex = frames.indexOf(page);
    let isHit = false;
    let replacedFrame = -1;
    let evictedPage = null;

    if (existingIndex !== -1) {
      isHit = true;
      hits++;
      bits[existingIndex] = 1;
    } else {
      faults++;
      const emptyIndex = frames.indexOf(null);
      if (emptyIndex !== -1) {
        frames[emptyIndex] = page;
        bits[emptyIndex] = 1;
        queue.push(emptyIndex);
        replacedFrame = emptyIndex;
      } else {
        // Inspect head of FIFO queue
        while (true) {
          const headIdx = queue.shift();
          if (bits[headIdx] === 1) {
            bits[headIdx] = 0;
            queue.push(headIdx);
          } else {
            // Evict
            evictedPage = frames[headIdx];
            frames[headIdx] = page;
            bits[headIdx] = 1;
            queue.push(headIdx);
            replacedFrame = headIdx;
            break;
          }
        }
      }
    }

    steps.push({
      time: timeList[t] || t + 1,
      page,
      frames: [...frames],
      bits: [...bits],
      isHit,
      replacedFrame,
      evictedPage,
      status: isHit ? "hit" : "fault"
    });
  });

  return { algo: "second_chance", refList, frameCount, steps, faults, hits };
}

/* 6. CLOCK REPLACEMENT */
function runClock(refList, frameCount, timeList) {
  const steps = [];
  const frames = Array(frameCount).fill(null);
  const bits = Array(frameCount).fill(0);
  let hand = 0;
  let faults = 0;
  let hits = 0;

  refList.forEach((page, t) => {
    const existingIndex = frames.indexOf(page);
    let isHit = false;
    let replacedFrame = -1;
    let evictedPage = null;

    if (existingIndex !== -1) {
      isHit = true;
      hits++;
      bits[existingIndex] = 1;
    } else {
      faults++;
      const emptyIndex = frames.indexOf(null);
      if (emptyIndex !== -1) {
        frames[emptyIndex] = page;
        bits[emptyIndex] = 1;
        replacedFrame = emptyIndex;
        hand = (emptyIndex + 1) % frameCount;
      } else {
        while (bits[hand] === 1) {
          bits[hand] = 0;
          hand = (hand + 1) % frameCount;
        }
        evictedPage = frames[hand];
        frames[hand] = page;
        bits[hand] = 1;
        replacedFrame = hand;
        hand = (hand + 1) % frameCount;
      }
    }

    steps.push({
      time: timeList[t] || t + 1,
      page,
      frames: [...frames],
      bits: [...bits],
      hand,
      isHit,
      replacedFrame,
      evictedPage,
      status: isHit ? "hit" : "fault"
    });
  });

  return { algo: "clock", refList, frameCount, steps, faults, hits };
}

/* Izvršavanje simulacije za odabrani algoritam */
function runPagingSimulation(algo, refList, frameCount, timeList, optLookahead = null) {
  if (algo === "opt") return runOpt(refList, frameCount, timeList, optLookahead);
  if (algo === "lru") return runLru(refList, frameCount, timeList);
  if (algo === "fifo") return runFifo(refList, frameCount, timeList);
  if (algo === "nfu") return runNfu(refList, frameCount, timeList);
  if (algo === "second_chance") return runSecondChance(refList, frameCount, timeList);
  return runClock(refList, frameCount, timeList);
}

/* Poređenje svih 6 algoritama */
function runAllPagingAlgorithms(refList, frameCount, timeList, optLookahead = null) {
  const algos = [];

  if (optLookahead) {
    algos.push({
      key: "opt_lookahead",
      name: `Optimalni (Lookahead: ${optLookahead})`,
      res: runOpt(refList, frameCount, timeList, optLookahead)
    });
    algos.push({
      key: "opt",
      name: "Optimalni (OPT - puni)",
      res: runOpt(refList, frameCount, timeList, null)
    });
  } else {
    algos.push({
      key: "opt",
      name: "Optimalni (OPT)",
      res: runOpt(refList, frameCount, timeList, null)
    });
  }

  algos.push(
    { key: "lru", name: "LRU", res: runLru(refList, frameCount, timeList) },
    { key: "fifo", name: "FIFO", res: runFifo(refList, frameCount, timeList) },
    { key: "nfu", name: "NFU", res: runNfu(refList, frameCount, timeList) },
    { key: "second_chance", name: "Second Chance", res: runSecondChance(refList, frameCount, timeList) },
    { key: "clock", name: "Clock", res: runClock(refList, frameCount, timeList) }
  );

  let best = algos[0];
  algos.forEach(a => {
    if (a.res.faults < best.res.faults) best = a;
  });

  return { algos, best, total: refList.length };
}

/* ---------- Prikaz i rendering ---------- */

function renderPagingSummaryCards(result) {
  const total = result.refList.length;
  const faults = result.faults;
  const hits = result.hits;
  const faultRate = total > 0 ? ((faults / total) * 100).toFixed(1) : 0;
  const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : 0;

  document.getElementById("summary-cards").innerHTML = `
    <div class="stat-card">
      <div class="stat-val" style="color:#dc3545;">${faults}</div>
      <div class="stat-label" data-i18n="metric.faults">${t("metric.faults")}</div>
      <div class="stat-sub">${faultRate}% stopa promašaja</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color:#28a745;">${hits}</div>
      <div class="stat-label" data-i18n="metric.hits">${t("metric.hits")}</div>
      <div class="stat-sub">${hitRate}% stopa pogodaka</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${total}</div>
      <div class="stat-label" data-i18n="metric.totalRequests">${t("metric.totalRequests")}</div>
      <div class="stat-sub">${result.frameCount} okvira${result.lookahead ? ` · Prozor: ${result.lookahead}` : ""}</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${hitRate}%</div>
      <div class="stat-label" data-i18n="metric.hitRate">${t("metric.hitRate")}</div>
      <div class="stat-sub">Učinkovitost keša</div>
    </div>
  `;
}

function renderPagingTable(result) {
  const { steps, frameCount, algo } = result;
  const host = document.getElementById("paging-table-container");
  if (!host) return;

  // Header row: Vrijeme t
  let headHtml = `<tr><th class="row-header">${t("tbl.time")}</th>`;
  steps.forEach((step, idx) => {
    headHtml += `<th id="th-step-${idx}">${step.time}</th>`;
  });
  headHtml += `</tr>`;

  // Ref row: Redosljed
  let refHtml = `<tr class="ref-row"><td class="row-header">${t("tbl.ref")}</td>`;
  steps.forEach((step, idx) => {
    refHtml += `<td id="ref-step-${idx}"><b>${step.page}</b></td>`;
  });
  refHtml += `</tr>`;

  // Frame rows: Okvir 1 .. Okvir N
  let framesHtml = "";
  for (let f = 0; f < frameCount; f++) {
    framesHtml += `<tr><td class="row-header">${t("tbl.frame")} ${f + 1}</td>`;
    steps.forEach((step, idx) => {
      const val = step.frames[f];
      const isReplaced = !step.isHit && step.replacedFrame === f;
      const isHitFrame = step.isHit && val === step.page;
      const isCandidate = algo === "lru" && step.candidateIndex === f && val !== null;

      let cls = "frame-cell";
      if (isReplaced) cls += " is-replaced";
      if (isHitFrame) cls += " is-hit";

      const star = isCandidate ? `<span class="cand-star">*</span>` : "";
      framesHtml += `<td class="${cls}" id="cell-f${f}-step-${idx}">${val !== null ? val + star : ""}</td>`;
    });
    framesHtml += `</tr>`;
  }

  // Status row: Zamjena / Pogodak
  let statusHtml = `<tr><td class="row-header">${t("tbl.status")}</td>`;
  steps.forEach((step, idx) => {
    const badge = step.isHit
      ? `<span class="status-hit-badge" title="${t("status.hit")}">⊕</span>`
      : `<span class="status-fault-badge" title="${t("status.fault")}">↑</span>`;
    statusHtml += `<td class="status-cell" id="status-step-${idx}">${badge}</td>`;
  });
  statusHtml += `</tr>`;

  let mainTable = `
    <div class="paging-table-wrap">
      <table class="paging-table">
        <thead>${headHtml}</thead>
        <tbody>
          ${refHtml}
          ${framesHtml}
          ${statusHtml}
        </tbody>
      </table>
    </div>
  `;

  // Auxiliary sub-table for NFU counters or Second Chance / Clock bits
  let subTable = "";
  if (algo === "nfu") {
    let subHead = `<tr><th class="row-header">${t("tbl.counters")}</th>`;
    steps.forEach(s => subHead += `<th>${s.time}</th>`);
    subHead += `</tr>`;

    let subBody = "";
    for (let f = 0; f < frameCount; f++) {
      subBody += `<tr><td class="row-header">${t("tbl.frame")} ${f + 1}</td>`;
      steps.forEach((s, idx) => {
        const c = s.counters ? s.counters[f] : 0;
        subBody += `<td id="sub-f${f}-step-${idx}">${c}</td>`;
      });
      subBody += `</tr>`;
    }

    subTable = `
      <div class="paging-subtable-title">Stanje brojača pristupa za svaki okvir:</div>
      <div class="paging-table-wrap">
        <table class="paging-subtable">
          <thead>${subHead}</thead>
          <tbody>${subBody}</tbody>
        </table>
      </div>
    `;
  } else if (algo === "second_chance" || algo === "clock") {
    let subHead = `<tr><th class="row-header">${t("tbl.bits")}</th>`;
    steps.forEach(s => subHead += `<th>${s.time}</th>`);
    subHead += `</tr>`;

    let subBody = "";
    for (let f = 0; f < frameCount; f++) {
      subBody += `<tr><td class="row-header">${t("tbl.frame")} ${f + 1}</td>`;
      steps.forEach((s, idx) => {
        const b = s.bits ? s.bits[f] : 0;
        subBody += `<td id="sub-f${f}-step-${idx}"><b>${b}</b></td>`;
      });
      subBody += `</tr>`;
    }

    subTable = `
      <div class="paging-subtable-title">Stanje bita korištenja (Reference bit R) za svaki okvir:</div>
      <div class="paging-table-wrap">
        <table class="paging-subtable">
          <thead>${subHead}</thead>
          <tbody>${subBody}</tbody>
        </table>
      </div>
    `;
  }

  host.innerHTML = mainTable + subTable;
}

function renderPagingExecutionLog(result) {
  const logEl = document.getElementById("log");
  if (!logEl) return;

  const lines = result.steps.map((step, idx) => {
    if (step.isHit) {
      return `[t = ${step.time}]: Zahtjev za stranicom <b>${step.page}</b> → <b>POGODAK (Hit ⊕)</b>. Stranica se već nalazi u memoriji. Sadržaj okvira ostaje nepromijenjen.`;
    } else if (step.evictedPage !== null) {
      const reasonHtml = step.decisionNote
        ? `<div style="font-size:0.85em; color:var(--text-muted); margin-top:3px; padding-left:14px; border-left:2px solid var(--accent);">↳ <em>${step.decisionNote}</em></div>`
        : "";
      return `[t = ${step.time}]: Zahtjev za stranicom <b>${step.page}</b> → <b>PROMAŠAJ (Zamjena ↑)</b>. Okvir ${step.replacedFrame + 1}: izbačena stranica <b>${step.evictedPage}</b>, upisana stranica <b>${step.page}</b>.${reasonHtml}`;
    } else {
      return `[t = ${step.time}]: Zahtjev za stranicom <b>${step.page}</b> → <b>PROMAŠAJ (Učitavanje ↑)</b>. Smještena u slobodni Okvir ${step.replacedFrame + 1}.`;
    }
  });

  logEl.innerHTML = lines.map(l => `<li>${l}</li>`).join("");
}

function renderPagingComparison(refList, frameCount, timeList, optLookahead = null) {
  const comp = runAllPagingAlgorithms(refList, frameCount, timeList, optLookahead);
  const host = document.getElementById("comparison-content");
  if (!host) return;

  let head = `<thead><tr>
    <th>Algoritam</th>
    <th>Broj promašaja</th>
    <th>Broj pogodaka</th>
    <th>Stopa promašaja</th>
    <th>Stopa pogodaka</th>
  </tr></thead>`;

  let body = "";
  comp.algos.forEach(a => {
    const isBest = a.key === comp.best.key;
    const fRate = ((a.res.faults / comp.total) * 100).toFixed(1);
    const hRate = ((a.res.hits / comp.total) * 100).toFixed(1);
    const rowCls = isBest ? "style='background:rgba(40,167,69,0.12); font-weight:700;'" : "";

    body += `<tr ${rowCls}>
      <td><b>${a.name}</b> ${isBest ? "⭐" : ""}</td>
      <td style="color:#dc3545;"><b>${a.res.faults}</b></td>
      <td style="color:#28a745;"><b>${a.res.hits}</b></td>
      <td>${fRate}%</td>
      <td>${hRate}%</td>
    </tr>`;
  });

  host.innerHTML = `
    <div class="best-algo-box">
      <span class="best-algo-icon">🏆</span>
      <div>
        <strong>${t("compare.pagingBest", { algo: comp.best.name, val: comp.best.res.faults })}</strong>
      </div>
    </div>
    <div class="table-wrap">
      <table class="result-table">
        ${head}
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

/* ---------- Animacija tabele zamjene stranica ---------- */

function stopPagingAnimation() {
  if (pagingAnimTimer) {
    clearInterval(pagingAnimTimer);
    pagingAnimTimer = null;
  }
  pagingAnimState.active = false;
  pagingAnimState.paused = false;
}

function updatePagingPlayButton(isPlaying) {
  const icon = document.getElementById("anim-play-icon");
  const text = document.getElementById("anim-play-text");
  if (icon && text) {
    icon.textContent = isPlaying ? "⏸" : "▶";
    text.textContent = isPlaying ? t("anim.pause") : t("anim.play");
  }
}

function highlightStep(stepIdx, result) {
  const total = result.steps.length;

  // Un-highlight previous
  document.querySelectorAll(".paging-table th, .paging-table td, .paging-subtable th, .paging-subtable td").forEach(el => {
    el.classList.remove("is-active-col");
  });

  if (stepIdx < 0 || stepIdx >= total) return;

  // Highlight step column
  const th = document.getElementById(`th-step-${stepIdx}`);
  if (th) th.classList.add("is-active-col");
  const ref = document.getElementById(`ref-step-${stepIdx}`);
  if (ref) ref.classList.add("is-active-col");
  const status = document.getElementById(`status-step-${stepIdx}`);
  if (status) status.classList.add("is-active-col");

  for (let f = 0; f < result.frameCount; f++) {
    const c = document.getElementById(`cell-f${f}-step-${stepIdx}`);
    if (c) c.classList.add("is-active-col");
    const sub = document.getElementById(`sub-f${f}-step-${stepIdx}`);
    if (sub) sub.classList.add("is-active-col");
  }

  // Scroll active column into view if needed
  if (th && th.scrollIntoView) {
    th.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  // Update status bar
  const step = result.steps[stepIdx];
  const timeBadge = document.getElementById("anim-time-badge");
  const statusText = document.getElementById("anim-status-text");

  if (timeBadge) timeBadge.textContent = `t = ${step.time} (${stepIdx + 1}/${total})`;
  if (statusText) {
    if (step.isHit) {
      statusText.innerHTML = `<span style="color:#28a745; font-weight:700;">Pogodak (Hit ⊕)</span>: Stranica <b>${step.page}</b> je već u okviru.`;
    } else if (step.evictedPage !== null) {
      const noteHtml = step.decisionNote ? ` <span style="font-size:0.85em; opacity:0.85;">(${step.decisionNote})</span>` : "";
      statusText.innerHTML = `<span style="color:#dc3545; font-weight:700;">Promašaj (Zamjena ↑)</span>: Stranica <b>${step.page}</b> zamjenjuje <b>${step.evictedPage}</b> u Okviru ${step.replacedFrame + 1}.${noteHtml}`;
    } else {
      statusText.innerHTML = `<span style="color:#dc3545; font-weight:700;">Promašaj (Učitavanje ↑)</span>: Stranica <b>${step.page}</b> u Okvir ${step.replacedFrame + 1}.`;
    }
  }
}

function showFullPaging(result) {
  stopPagingAnimation();
  updatePagingPlayButton(false);
  highlightStep(-1, result);
  const statusText = document.getElementById("anim-status-text");
  const timeBadge = document.getElementById("anim-time-badge");
  if (timeBadge) timeBadge.textContent = `Ukupno: ${result.steps.length} koraka`;
  if (statusText) statusText.textContent = `Prikazana kompletna tabela (${result.faults} promašaja, ${result.hits} pogodaka).`;
}

function startPagingAnimation(result) {
  stopPagingAnimation();
  if (!result || !result.steps.length) return;

  pagingAnimState.active = true;
  pagingAnimState.paused = false;
  pagingAnimState.currentStep = 0;
  pagingAnimState.totalSteps = result.steps.length;
  pagingAnimState.result = result;
  updatePagingPlayButton(true);

  highlightStep(0, result);

  const baseInterval = 900;
  const tickInterval = () => Math.max(150, baseInterval / pagingAnimState.speed);

  const loop = () => {
    if (!pagingAnimState.active || pagingAnimState.paused) return;

    if (pagingAnimState.currentStep < pagingAnimState.totalSteps - 1) {
      pagingAnimState.currentStep += 1;
      highlightStep(pagingAnimState.currentStep, result);
      pagingAnimTimer = setTimeout(loop, tickInterval());
    } else {
      stopPagingAnimation();
      updatePagingPlayButton(false);
      const statusText = document.getElementById("anim-status-text");
      if (statusText) statusText.innerHTML = `<b>✔ Završeno:</b> Ukupno ${result.faults} promašaja i ${result.hits} pogodaka.`;
    }
  };

  pagingAnimTimer = setTimeout(loop, tickInterval());
}

function togglePagingAnimation() {
  if (!pagingAnimState.result) return;

  if (!pagingAnimState.active) {
    startPagingAnimation(pagingAnimState.result);
  } else if (pagingAnimState.paused) {
    pagingAnimState.paused = false;
    updatePagingPlayButton(true);
    const baseInterval = 900;
    const tickInterval = () => Math.max(150, baseInterval / pagingAnimState.speed);

    const loop = () => {
      if (!pagingAnimState.active || pagingAnimState.paused) return;
      if (pagingAnimState.currentStep < pagingAnimState.totalSteps - 1) {
        pagingAnimState.currentStep += 1;
        highlightStep(pagingAnimState.currentStep, pagingAnimState.result);
        pagingAnimTimer = setTimeout(loop, tickInterval());
      } else {
        stopPagingAnimation();
        updatePagingPlayButton(false);
      }
    };
    pagingAnimTimer = setTimeout(loop, tickInterval());
  } else {
    pagingAnimState.paused = true;
    clearTimeout(pagingAnimTimer);
    pagingAnimTimer = null;
    updatePagingPlayButton(false);
    const statusText = document.getElementById("anim-status-text");
    if (statusText) statusText.textContent = `⏸ Pauzirano na koraku ${pagingAnimState.currentStep + 1}`;
  }
}

/* ---------- Inicijalizacija stranice ---------- */

function readPagingInputs() {
  const refInput = document.getElementById("ref-input").value;
  const timeInput = document.getElementById("time-input").value;
  const framesInput = Number(document.getElementById("frames-input").value);

  const refList = parseReferenceList(refInput);
  if (!refList || !refList.length) {
    return { error: t("error.invalidRef") };
  }

  if (!Number.isInteger(framesInput) || framesInput < 1 || framesInput > 10) {
    return { error: t("error.invalidFrames") };
  }

  const algo = document.body.dataset.pagingAlgo;
  let lookahead = null;
  const lookaheadCheckbox = document.getElementById("lookahead-enable");
  const lookaheadInput = document.getElementById("lookahead-steps");

  if (algo === "opt" && lookaheadCheckbox && lookaheadCheckbox.checked) {
    const stepsVal = Number(lookaheadInput ? lookaheadInput.value : 0);
    if (!Number.isInteger(stepsVal) || stepsVal < 1) {
      return { error: t("error.invalidLookahead") };
    }
    lookahead = stepsVal;
  }

  const timeList = parseTimeList(timeInput, refList.length);
  return { refList, frameCount: framesInput, timeList, lookahead };
}

function renderPaging(result, parsed) {
  const badge = document.getElementById("algo-badge");
  if (badge) {
    if (result.algo === "opt" && result.lookahead) {
      badge.textContent = `OPTIMALNI (Lookahead: ${result.lookahead})`;
    } else {
      badge.textContent = PAGING_BADGES[result.algo] || result.algo.toUpperCase();
    }
  }

  renderPagingSummaryCards(result);
  renderPagingTable(result);
  renderPagingExecutionLog(result);
  renderPagingComparison(parsed.refList, parsed.frameCount, parsed.timeList, parsed.lookahead);

  const results = document.getElementById("results");
  results.style.display = "block";

  startPagingAnimation(result);
}

function clearPagingResults() {
  stopPagingAnimation();
  lastPagingResult = null;
  const results = document.getElementById("results");
  if (results) results.style.display = "none";
  const tableHost = document.getElementById("paging-table-container");
  if (tableHost) tableHost.innerHTML = "";
  const log = document.getElementById("log");
  if (log) log.innerHTML = "";
  const comp = document.getElementById("comparison-content");
  if (comp) comp.style.display = "none";
}

function applyPagingPreset(presetKey) {
  const p = PAGING_PRESETS[presetKey];
  if (!p) return;

  const refInput = document.getElementById("ref-input");
  const timeInput = document.getElementById("time-input");
  const framesInput = document.getElementById("frames-input");

  if (refInput) refInput.value = p.ref;
  if (timeInput) timeInput.value = p.time || "";
  if (framesInput) framesInput.value = p.frames;
}

function initPagingPage() {
  const algo = document.body.dataset.pagingAlgo;
  if (!algo) return;

  const refInput = document.getElementById("ref-input");
  const timeInput = document.getElementById("time-input");
  const framesInput = document.getElementById("frames-input");
  const error = document.getElementById("error");

  // Defaults
  refInput.value = PAGING_DEFAULTS.ref;
  timeInput.value = PAGING_DEFAULTS.time;
  framesInput.value = PAGING_DEFAULTS.frames;

  // Lookahead toggle for OPT
  const lookaheadCheckbox = document.getElementById("lookahead-enable");
  const lookaheadWrap = document.getElementById("lookahead-input-wrap");
  const lookaheadInput = document.getElementById("lookahead-steps");
  if (lookaheadCheckbox && lookaheadWrap) {
    lookaheadCheckbox.addEventListener("change", () => {
      lookaheadWrap.style.display = lookaheadCheckbox.checked ? "flex" : "none";
    });
  }

  // Presets
  ["p1"].forEach(key => {
    const btn = document.getElementById(`preset-${key}`);
    if (btn) {
      btn.addEventListener("click", () => applyPagingPreset(key));
    }
  });

  // Animation controls
  const playBtn = document.getElementById("anim-play-btn");
  if (playBtn) playBtn.addEventListener("click", togglePagingAnimation);

  const replayBtn = document.getElementById("anim-replay-btn");
  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      if (lastPagingResult) startPagingAnimation(lastPagingResult);
    });
  }

  const speedSelect = document.getElementById("anim-speed");
  if (speedSelect) {
    speedSelect.addEventListener("change", e => {
      pagingAnimState.speed = Number(e.target.value) || 1;
    });
  }

  const skipBtn = document.getElementById("anim-skip-btn");
  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      if (lastPagingResult) showFullPaging(lastPagingResult);
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

  // Start & Reset
  document.getElementById("start").addEventListener("click", () => {
    const parsed = readPagingInputs();
    if (parsed.error) {
      error.textContent = parsed.error;
      return;
    }
    error.textContent = "";
    lastPagingInput = parsed;
    lastPagingResult = runPagingSimulation(algo, parsed.refList, parsed.frameCount, parsed.timeList, parsed.lookahead);
    renderPaging(lastPagingResult, parsed);
  });

  document.getElementById("reset").addEventListener("click", () => {
    refInput.value = PAGING_DEFAULTS.ref;
    timeInput.value = PAGING_DEFAULTS.time;
    framesInput.value = PAGING_DEFAULTS.frames;
    if (lookaheadCheckbox) lookaheadCheckbox.checked = false;
    if (lookaheadWrap) lookaheadWrap.style.display = "none";
    if (lookaheadInput) lookaheadInput.value = "3";
    error.textContent = "";
    clearPagingResults();
  });

  window.onLanguageChange = () => {
    if (lastPagingResult && lastPagingInput) {
      lastPagingResult = runPagingSimulation(algo, lastPagingInput.refList, lastPagingInput.frameCount, lastPagingInput.timeList, lastPagingInput.lookahead);
      renderPaging(lastPagingResult, lastPagingInput);
    }
  };
}

document.addEventListener("DOMContentLoaded", initPagingPage);
