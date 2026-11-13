import { yearRibbons } from "./analytics.js";
import { BEACH_TIME_ZONE } from "./config.js";
import { DateTime, formatDate } from "./dates.js";
import { emptyNode, flagKeyNode, h } from "./dom.js";
import { getFlagMeta, orderedFlagsFrom } from "./flags.js";
import { formatInteger, sum } from "./format.js";

const ribbon = document.getElementById("dayRibbon");
const legend = document.getElementById("dayRibbonLegend");
const detail = document.getElementById("dayRibbonDetail");
const playButton = document.getElementById("ribbonPlayBtn");

const HIGH_HAZARD = ["red-flag", "red-over-purple-flag", "double-red-flag"];

const state = {
  days: new Map(),
  totals: new Map(),
  filter: null,
  selectedDate: null,
  frame: null,
  onOpen: () => {},
};

export function initRibbon({ onOpen }) {
  state.onOpen = onOpen;
  playButton.addEventListener("click", togglePlayback);

  const whenIdle = (handler) => (event) => {
    if (!state.frame) handler(event.target.closest?.(".ribbon-day")?.dataset.date);
  };
  ribbon.addEventListener("mouseover", whenIdle((date) => date && showDetail(date)));
  ribbon.addEventListener("mouseleave", whenIdle(() => showDetail(state.selectedDate)));
  ribbon.addEventListener("click", whenIdle((date) => date && selectDay(date)));
}

export function renderRibbon(history) {
  stopPlayback();

  const years = yearRibbons(history);
  const days = years.flatMap((year) => year.days);
  const recorded = days.filter((day) => day.dominant);

  Object.assign(state, { days: new Map(days.map((day) => [day.date, day])), totals: new Map(), filter: null, selectedDate: null });
  ribbon.replaceChildren();
  legend.replaceChildren();
  playButton.disabled = !recorded.length;

  if (!recorded.length) {
    ribbon.append(emptyNode("No historical flag records are available."));
    detail.replaceChildren();
    return;
  }

  recorded.forEach(({ dominant }) => state.totals.set(dominant.className, (state.totals.get(dominant.className) || 0) + 1));

  ribbon.append(...years.map(yearNode));
  legend.append(...orderedFlagsFrom(recorded.map((day) => ({ flag_type: day.dominant.label }))).map((flag) =>
    flagKeyNode(flag, formatInteger(state.totals.get(flag.className)), () => {
      state.filter = state.filter === flag.className ? null : flag.className;
      applyFilter();
    })
  ));
  showDetail(null);

  // On narrow screens the grid scrolls sideways; start at the most recent days.
  const latest = ribbon.querySelector(`[data-date="${recorded[recorded.length - 1].date}"]`);
  ribbon.scrollLeft = Math.max(0, latest.offsetLeft - ribbon.clientWidth + 48);
}

function yearNode(year) {
  return h(
    "div.ribbon-year",
    h("p.ribbon-year-label", year.year),
    h(
      "div.ribbon-grid",
      year.months.map((month) => h("span.ribbon-month", { style: { "grid-column": `${month.column + 2} / span 3` } }, month.label)),
      [["Mon", 1], ["Wed", 3], ["Fri", 5]].map(([text, row]) => h("span.ribbon-weekday", { style: { "grid-row": row + 2 } }, text)),
      year.days.map((day) => h(`span.ribbon-day.${day.dominant ? day.dominant.className : "no-readings"}`, {
        dataset: { date: day.date },
        style: { "grid-column": day.column + 2, "grid-row": day.row + 2 },
      }))
    )
  );
}

function showDetail(date) {
  const day = date ? state.days.get(date) : null;

  if (!day) {
    const recorded = sum([...state.totals.values()]);
    const high = sum(HIGH_HAZARD.map((className) => state.totals.get(className) || 0));
    detail.textContent = `${formatInteger(recorded)} days on record, ${Math.round((high / recorded) * 100)}% reached red or higher.`;
    return;
  }

  detail.replaceChildren(...[
    h("strong", DateTime.fromISO(day.date, { zone: BEACH_TIME_ZONE }).toFormat("ccc, LLL d, yyyy")),
    h("span", dayText(day)),
    day.dominant && state.selectedDate === day.date &&
      h("button.ghost-button", { type: "button", onclick: () => state.onOpen(day.date) }, "Open this day"),
  ].filter(Boolean));
}

function dayText(day) {
  if (!day.dominant) return "No readings were recorded.";

  const counts = new Map();
  day.flags.forEach((entry) => {
    const { label } = getFlagMeta(entry.flag_type);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const readings = `${day.flags.length} ${day.flags.length === 1 ? "reading" : "readings"}`;
  if (counts.size === 1) return `${day.dominant.label} all day (${readings}).`;
  return `${readings}: ${[...counts].sort((a, b) => b[1] - a[1]).map(([label, count]) => `${count} ${label}`).join(", ")}.`;
}

function selectDay(date) {
  state.selectedDate = state.selectedDate === date ? null : date;
  ribbon.querySelectorAll(".ribbon-day.selected").forEach((cell) => cell.classList.remove("selected"));
  if (state.selectedDate) ribbon.querySelector(`[data-date="${date}"]`).classList.add("selected");
  showDetail(state.selectedDate);
}

function applyFilter() {
  ribbon.querySelectorAll(".ribbon-day").forEach((cell) => {
    cell.classList.toggle("is-dimmed", Boolean(state.filter) && !cell.classList.contains(state.filter));
  });
  legend.querySelectorAll(".flag-key").forEach((key) => {
    key.setAttribute("aria-pressed", String(key.dataset.flag === state.filter));
  });
}

function showKeyCounts(counts) {
  legend.querySelectorAll(".flag-key").forEach((key) => {
    key.querySelector(".flag-key-count").textContent = formatInteger(counts.get(key.dataset.flag));
  });
}

// Reveals the days in order while the legend tallies them.
function togglePlayback() {
  if (state.frame) {
    stopPlayback();
    return;
  }

  const cells = Array.from(ribbon.querySelectorAll(".ribbon-day"));
  if (!cells.length) return;

  state.filter = null;
  applyFilter();
  cells.forEach((cell) => cell.classList.add("is-pending"));
  playButton.textContent = "Stop";

  const counts = new Map();
  const duration = Math.min(12000, Math.max(4000, cells.length * 10));
  const startedAt = performance.now();
  let shown = 0;

  const step = (now) => {
    const target = Math.min(cells.length, Math.ceil(((now - startedAt) / duration) * cells.length));
    while (shown < target) {
      const cell = cells[shown];
      const flag = state.days.get(cell.dataset.date)?.dominant;
      cell.classList.remove("is-pending");
      if (flag) counts.set(flag.className, (counts.get(flag.className) || 0) + 1);
      shown += 1;
    }

    showKeyCounts(counts);
    if (shown) detail.textContent = `Through ${formatDate(cells[shown - 1].dataset.date)}`;

    if (shown < cells.length) state.frame = window.requestAnimationFrame(step);
    else stopPlayback();
  };

  state.frame = window.requestAnimationFrame(step);
}

function stopPlayback() {
  if (state.frame) window.cancelAnimationFrame(state.frame);
  state.frame = null;
  playButton.textContent = "Play history";
  ribbon.querySelectorAll(".is-pending").forEach((cell) => cell.classList.remove("is-pending"));
  if (!state.totals.size) return;
  showKeyCounts(state.totals);
  showDetail(state.selectedDate);
}
