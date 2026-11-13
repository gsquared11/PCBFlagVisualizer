import { API } from "./config.js";
import { apiGet } from "./api.js";
import { formatDateTime } from "./dates.js";
import { h, hideError, showError } from "./dom.js";
import { titleCase } from "./format.js";

const details = document.getElementById("rawDataDetails");
const tableContainer = document.getElementById("tableContainer");
const loading = document.getElementById("loadingContainer");
const headers = document.getElementById("tableHeaders");
const body = document.getElementById("tableBody");
const pagination = document.getElementById("paginationContainer");
const prevButton = document.getElementById("prevPageBtn");
const nextButton = document.getElementById("nextPageBtn");
const currentPage = document.getElementById("currentPage");

const COLUMN_LABELS = { date_time: "Recorded Time", flag_type: "Flag" };
const state = { limit: 25, offset: 0, page: 1, hasLoaded: false };

prevButton.addEventListener("click", () => changePage(-1));
nextButton.addEventListener("click", () => changePage(1));

// Rows load the first time the section is opened.
details.addEventListener("toggle", () => {
  if (details.open && !state.hasLoaded) refreshTable();
  else pagination.classList.toggle("hidden", !details.open);
});

async function refreshTable() {
  loading.style.display = "flex";
  tableContainer.classList.remove("hidden");

  try {
    const payload = await apiGet(API.tableData, { limit: state.limit, offset: state.offset });
    renderTable(payload.data || []);
    currentPage.textContent = `Page ${state.page}`;
    prevButton.disabled = state.offset <= 0;
    nextButton.disabled = payload.pagination?.next_offset == null;
    state.hasLoaded = true;
    pagination.classList.toggle("hidden", !details.open);
    hideError();
  } catch (error) {
    showError(`Failed to load raw data: ${error.message}`);
  } finally {
    loading.style.display = "none";
  }
}

function renderTable(rows) {
  headers.replaceChildren();
  body.replaceChildren();

  if (!rows.length) {
    tableContainer.classList.add("hidden");
    showError("No raw flag data is available.");
    return;
  }

  const columns = Object.keys(rows[0]).filter((column) => column !== "id");
  headers.append(...columns.map((column) => h("th", COLUMN_LABELS[column] || titleCase(column.replaceAll("_", " ")))));
  body.append(...rows.map((row) => h("tr", columns.map((column) =>
    h("td", column === "date_time" ? formatDateTime(row[column]) : row[column] ?? "")
  ))));
}

function changePage(direction) {
  const offset = state.offset + direction * state.limit;
  if (offset < 0) return;

  state.offset = offset;
  state.page += direction;
  refreshTable();
}
