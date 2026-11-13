import { BEACH_TIME_ZONE } from "./config.js";
import { getHistory, loadHistory } from "./api.js";
import { groupFlagsByDate } from "./analytics.js";
import { DateTime, formatDate } from "./dates.js";
import { h, showError } from "./dom.js";
import { getFlagMeta, mostSevereFlag, summarizeFlags } from "./flags.js";

const grid = document.getElementById("calendar-grid");
const title = document.querySelector(".calendar-title");

const state = {
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  selectedDate: null,
  onSelect: () => {},
};

export function initCalendar({ onSelect }) {
  state.onSelect = onSelect;
  document.getElementById("prevMonthBtn").addEventListener("click", () => moveMonth(-1));
  document.getElementById("nextMonthBtn").addEventListener("click", () => moveMonth(1));
}

export async function refreshCalendar() {
  try {
    await loadHistory();
    renderCalendar();
  } catch (error) {
    showError(`Failed to load calendar flags: ${error.message}`);
  }
}

export function selectDate(date) {
  state.selectedDate = date;
  renderCalendar();
}

export function showMonthOf(date) {
  const day = DateTime.fromISO(date, { zone: BEACH_TIME_ZONE });
  state.month = day.month - 1;
  state.year = day.year;
}

export function renderCalendar() {
  const monthStart = DateTime.fromObject({ year: state.year, month: state.month + 1, day: 1 }, { zone: BEACH_TIME_ZONE });
  const flagsByDate = groupFlagsByDate(getHistory());

  title.textContent = monthStart.toFormat("LLLL yyyy");
  grid.replaceChildren(
    ...["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => h("div.calendar-day-header", day)),
    ...Array.from({ length: monthStart.weekday % 7 }, () => h("div.calendar-day.empty")),
    ...Array.from({ length: monthStart.daysInMonth }, (_, index) => {
      const date = monthStart.set({ day: index + 1 }).toISODate();
      return dayNode(date, index + 1, flagsByDate.get(date) || []);
    })
  );
}

function moveMonth(delta) {
  const next = DateTime
    .fromObject({ year: state.year, month: state.month + 1, day: 1 }, { zone: BEACH_TIME_ZONE })
    .plus({ months: delta });
  state.month = next.month - 1;
  state.year = next.year;
  renderCalendar();

  // Restart the slide so repeated clicks in one direction animate each time.
  grid.classList.remove("slide-next", "slide-prev");
  void grid.offsetWidth;
  grid.classList.add(delta > 0 ? "slide-next" : "slide-prev");
}

function dayNode(date, day, flags) {
  const dominant = flags.length ? mostSevereFlag(flags) : null;
  const button = h(
    "button.calendar-day",
    {
      type: "button",
      dataset: { date },
      "aria-label": `${formatDate(date)} ${flags.length ? summarizeFlags(flags) : "no flags recorded"}`,
      onclick: () => state.onSelect(date),
    },
    h("span.calendar-day-number", day),
    dominant && h("span.calendar-day-meta", metaText(flags))
  );

  button.classList.toggle("selected", state.selectedDate === date);
  if (dominant) button.classList.add("has-flags", dominant.className);
  return button;
}

function metaText(flags) {
  const labels = new Set(flags.map((flag) => getFlagMeta(flag.flag_type).label));
  return labels.size > 1 ? `${labels.size} types` : [...labels][0].replace(" Flag", "");
}
