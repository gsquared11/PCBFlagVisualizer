import { initCalendar, refreshCalendar, renderCalendar, selectDate, showMonthOf } from "./js/calendar.js";
import { applyChartDefaults } from "./js/charts.js";
import { refreshCharts } from "./js/charts-tab.js";
import { refreshCurrentFlag } from "./js/current-flag.js";
import { dateInput, initDayLookup, loadDay } from "./js/day.js";
import { showError } from "./js/dom.js";
import { initRibbon } from "./js/ribbon.js";
import "./js/raw-table.js";

const menu = document.querySelector(".site-menu");
const tabs = Array.from(document.querySelectorAll("[role='tab']"));
const panels = Array.from(document.querySelectorAll(".tab-content"));
const lookupPanel = document.querySelector(".date-picker-container");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applyChartDefaults();
  initCalendar({ onSelect: (date) => showDay(date, true) });
  initDayLookup({ onLookup: (date) => showDay(date) });
  initRibbon({
    onOpen: (date) => {
      showMonthOf(date);
      switchTab("calendar");
      showDay(date, true);
    },
  });
  tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));
  watchStickyMenu();

  try {
    await Promise.allSettled([refreshCurrentFlag(), refreshCalendar()]);
    switchTab("calendar");
    window.setInterval(refreshCalendar, 60 * 60 * 1000);
  } catch (error) {
    showError(`Failed to initialize app: ${error.message}`);
  }
}

function switchTab(name) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === name;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === name));

  if (name === "charts") refreshCharts();
  if (name === "calendar") renderCalendar();
}

// Highlights the day in the calendar and loads its flags and weather below.
function showDay(date, scroll = false) {
  selectDate(date);
  dateInput.value = date;
  loadDay(date);
  if (scroll) lookupPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function watchStickyMenu() {
  let stickyAt = 0;
  let ticking = false;

  const update = () => menu.classList.toggle("is-stuck", window.scrollY > stickyAt - 8);
  const measure = () => {
    stickyAt = menu.offsetTop;
    update();
  };

  measure();
  window.addEventListener("resize", measure);
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  }, { passive: true });
}
