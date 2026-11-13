import { API, BEACH_TIME_ZONE } from "./config.js";
import { apiGet } from "./api.js";
import { DateTime, formatDate, formatDateTime, formatTime } from "./dates.js";
import { h, statNode } from "./dom.js";
import { getFlagMeta, removeFlagClasses, severityLabel } from "./flags.js";
import { formatNumber, isNumber, sum } from "./format.js";

const card = document.getElementById("currentFlagCondition");
const flagpole = document.getElementById("flagpole");
const flagValue = card.querySelector(".flag-value");
const flagDesc = card.querySelector(".flag-desc");
const flagStats = card.querySelector(".flag-stats");
const conditionsTime = document.getElementById("currentConditionsTime");
const conditionsGrid = document.getElementById("currentConditionsGrid");
const conditionsNote = document.getElementById("currentMeaning");

// The flag is drawn as thin vertical slices so each can ride the wave a beat behind its neighbor.
flagpole.querySelectorAll(".flagpole-flag").forEach((flag) => {
  flag.append(...Array.from({ length: 30 }, (_, index) => h("span", { style: { "--i": index } })));
});

export async function refreshCurrentFlag() {
  try {
    const payload = await apiGet(API.tableData, { limit: 1, offset: 0 });
    const latest = payload.data?.[0];
    if (!latest) {
      showConditionsUnavailable();
      return;
    }

    const flag = getFlagMeta(latest.flag_type);
    removeFlagClasses(card);
    card.classList.add(flag.className);
    flagValue.textContent = flag.label;
    flagDesc.textContent = flag.description;
    flagStats.replaceChildren(
      statNode("Updated", formatDateTime(latest.date_time) || "Unknown"),
      statNode("Hazard", severityLabel(flag.severity))
    );
    flagpole.classList.add("is-raised");
    await refreshCurrentConditions();
  } catch (error) {
    flagValue.textContent = "Unavailable";
    flagDesc.textContent = "Flag data could not be loaded.";
    flagStats.replaceChildren();
    flagpole.classList.remove("is-raised");
    showConditionsUnavailable();
  }
}

async function refreshCurrentConditions() {
  const now = DateTime.now().setZone(BEACH_TIME_ZONE);
  const today = now.toISODate();

  try {
    const weather = await apiGet(API.weatherData, { date: today });
    const hourly = weather.hourly_data || [];
    const current = nearestTimedRow(hourly, now);
    const marine = nearestTimedRow(weather.marine_data || [], now);
    const rain = weather.summary?.precipitation_sum ?? sum(hourly.map((row) => row.precipitation).filter(isNumber));

    conditionsTime.textContent = current?.time ? `Near ${formatTime(current.time)}` : formatDate(today);
    showConditions(current?.wind_speed, current?.wind_gust, marine?.wave_height_ft, rain);
    conditionsNote.replaceChildren();
    setFlagWind(current?.wind_speed);
  } catch (error) {
    showConditionsUnavailable();
  }
}

function nearestTimedRow(rows, target) {
  return rows
    .map((row) => ({ row, time: DateTime.fromISO(row.time, { setZone: true }).setZone(BEACH_TIME_ZONE) }))
    .filter((entry) => entry.time.isValid)
    .sort((a, b) => Math.abs(a.time.diff(target).as("minutes")) - Math.abs(b.time.diff(target).as("minutes")))[0]?.row;
}

function showConditions(wind, gusts, surf, rain) {
  const metric = (label, value, digits, unit) =>
    h("div.condition-metric", h("span", label), h("strong", value == null ? "N/A" : `${formatNumber(value, digits)} ${unit}`));

  conditionsGrid.replaceChildren(
    metric("Wind", wind, 0, "mph"),
    metric("Gusts", gusts, 0, "mph"),
    metric("Surf", surf, 1, "ft"),
    metric("Rain", rain, 2, "in")
  );
}

function showConditionsUnavailable() {
  conditionsTime.textContent = "Unavailable";
  showConditions();
  conditionsNote.textContent = "Weather and surf data could not be loaded.";
}

// Windier conditions make the flag wave faster and wider.
function setFlagWind(mph) {
  const wind = isNumber(mph) ? Math.min(mph, 30) : 8;
  flagpole.style.setProperty("--wave-duration", `${(3.4 - wind * 0.07).toFixed(2)}s`);
  flagpole.style.setProperty("--wave-scale", (0.6 + wind / 25).toFixed(2));
}
