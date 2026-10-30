/* Simulacija algoritama raspodjele memorije
   Tip algoritma se uzima iz atributa <body data-algo="first|next|best|worst|quick"> */

const DEFAULTS = {
  blocks: "20, 6, 8, 30, 27, 9, 29, 20",
  processes: "6, 11, 5"
};

let lastResult = null;

/* ---------- Pomoćne funkcije ---------- */
function parseList(str) {
  const parts = str.split(",").map(s => s.trim()).filter(s => s !== "");
  if (!parts.length) return null;
  const nums = parts.map(Number);
  if (nums.some(n => !Number.isInteger(n) || n <= 0)) return null;
  return nums;
}

function blockLabel(id) {
  return `${t("block")} ${id}`;
}

function processLabel(id) {
  return `${t("process")} ${id}`;
}

/* ---------- Algoritmi ---------- */
const algorithms = {
  first(blocks, p) {
    return blocks.findIndex(b => b.remaining >= p.size);
  },

  next(blocks, p, state) {
    const n = blocks.length;
    for (let k = 0; k < n; k++) {
      const i = (state.pointer + k) % n;
      if (blocks[i].remaining >= p.size) { state.pointer = i; return i; }
    }
    return -1;
  },

  best(blocks, p) {
    let idx = -1;
    blocks.forEach((b, i) => {
      if (b.remaining >= p.size && (idx === -1 || b.remaining < blocks[idx].remaining)) idx = i;
    });
    return idx;
  },

  worst(blocks, p) {
    let idx = -1;
    blocks.forEach((b, i) => {
      if (b.remaining >= p.size && (idx === -1 || b.remaining > blocks[idx].remaining)) idx = i;
    });
    return idx;
  },

  quick(blocks, p, state) {
    if (state.frequent.includes(p.size)) {
      const list = buildQuickList(blocks, p.size);
      if (list.length) {
        state.note = t("quick.noteList", {
          size: p.size,
          blocks: list.map(i => blockLabel(i + 1)).join(", ")
        });
        return list[0];
      }
      state.note = t("quick.noteEmpty", { size: p.size });
      return -1;
    }
    state.note = t("quick.noteGeneral");
    return blocks.findIndex(b => b.remaining >= p.size);
  }
};

function buildQuickList(blocks, size) {
  return blocks
    .map((b, i) => ({ i, r: b.remaining }))
    .filter(x => x.r >= size)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.i);
}

function findFrequentSizes(processSizes) {
  const count = {};
  processSizes.forEach(s => count[s] = (count[s] || 0) + 1);
  let freq = Object.keys(count).filter(s => count[s] >= 2).map(Number);
  if (!freq.length) freq = [...new Set(processSizes)].slice(0, 3);
  return freq;
}

function formatLogNote(algo, note) {
  return algo === "quick" && note ? ` (${note})` : "";
}

/* ---------- Simulacija ---------- */
function runSimulation(algo, blockSizes, processSizes) {
  const blocks = blockSizes.map((s, i) => ({ id: i + 1, size: s, remaining: s, procs: [] }));
  const procs = processSizes.map((s, i) => ({ id: i + 1, size: s, block: null }));
  const log = [];
  const state = { pointer: 0, frequent: [], note: "" };
  const extra = { algo };

  if (algo === "quick") {
    state.frequent = findFrequentSizes(processSizes);
    extra.initialLists = state.frequent.map(sz => ({ size: sz, blocks: buildQuickList(blocks, sz) }));
  }

  procs.forEach(p => {
    const idx = algorithms[algo](blocks, p, state);
    const note = formatLogNote(algo, state.note);
    if (idx === -1) {
      log.push(t("log.notAllocated", { id: p.id, size: p.size, note }));
    } else {
      blocks[idx].remaining -= p.size;
      blocks[idx].procs.push(p.id);
      p.block = idx + 1;
      log.push(t("log.allocated", {
        id: p.id,
        size: p.size,
        block: idx + 1,
        rem: blocks[idx].remaining,
        note
      }));
    }
  });

  return { blocks, procs, log, extra };
}

/* ---------- Prikaz ---------- */
function render(result) {
  const { blocks, procs, log, extra } = result;

  document.getElementById("blocks").innerHTML = blocks.map(b => {
    const used = b.procs.length > 0;
    return `<div class="item ${used ? "allocated" : "free"}">
      <b>${blockLabel(b.id)}</b>${t("size")}: ${b.size}<br>${t("remaining")}: ${b.remaining}
      ${used ? `<br>${t("allocatedTo")}: ${b.procs.map(p => processLabel(p)).join(", ")}` : ""}
    </div>`;
  }).join("");

  document.getElementById("processes").innerHTML = procs.map(p => {
    const ok = p.block !== null;
    return `<div class="item ${ok ? "proc-ok" : "proc-fail"}">
      <b>${processLabel(p.id)}</b>${t("size")}: ${p.size}<br>
      ${t("status")}: ${ok ? `${t("status.ok")} ${p.block}` : t("status.fail")}
    </div>`;
  }).join("");

  const allocated = procs.filter(p => p.block !== null).length;
  const totalFree = blocks.reduce((s, b) => s + b.remaining, 0);
  document.getElementById("summary").innerHTML =
    `<span>${t("summary.allocated")}: <b>${allocated}</b></span>
     <span>${t("summary.notAllocated")}: <b>${procs.length - allocated}</b></span>
     <span>${t("summary.remaining")}: <b>${totalFree}</b></span>`;
  document.getElementById("log").innerHTML = log.map(l => `<li>${l}</li>`).join("");

  const quickPanel = document.getElementById("quick-panel");
  if (quickPanel && extra.initialLists) {
    document.getElementById("quick-lists").innerHTML = extra.initialLists.map(l =>
      `<li>${t("quick.listItem", { size: l.size })}: ${l.blocks.length ? l.blocks.map(i => blockLabel(i + 1)).join(", ") : t("quick.empty")}</li>`
    ).join("");
    quickPanel.style.display = "block";
  }
  document.getElementById("results").style.display = "block";
}

function clearResults() {
  const empty = t("empty.clickStart");
  document.getElementById("blocks").innerHTML = `<div class="empty">${empty}</div>`;
  document.getElementById("processes").innerHTML = `<div class="empty">${empty}</div>`;
  document.getElementById("results").style.display = "none";
  const qp = document.getElementById("quick-panel");
  if (qp) qp.style.display = "none";
  lastResult = null;
}

/* ---------- Inicijalizacija ---------- */
function initSimulationPage() {
  const algo = document.body.dataset.algo;
  if (!algo) return;

  const blocksInput = document.getElementById("blocks-input");
  const procsInput = document.getElementById("procs-input");
  const error = document.getElementById("error");

  blocksInput.value = DEFAULTS.blocks;
  procsInput.value = DEFAULTS.processes;
  clearResults();

  document.getElementById("start").addEventListener("click", () => {
    const b = parseList(blocksInput.value);
    const p = parseList(procsInput.value);
    if (!b || !p) {
      error.textContent = t("error.invalidInput");
      return;
    }
    error.textContent = "";
    lastResult = runSimulation(algo, b, p);
    render(lastResult);
  });

  document.getElementById("reset").addEventListener("click", () => {
    blocksInput.value = DEFAULTS.blocks;
    procsInput.value = DEFAULTS.processes;
    error.textContent = "";
    clearResults();
  });

  window.onLanguageChange = () => {
    if (lastResult) {
      lastResult = runSimulation(algo, parseList(blocksInput.value), parseList(procsInput.value));
      render(lastResult);
    } else {
      clearResults();
    }
  };
}

document.addEventListener("DOMContentLoaded", initSimulationPage);
