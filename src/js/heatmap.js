import { weekdayTimeBuckets } from "./analytics.js";
import { TIME_BUCKETS, WEEKDAYS } from "./config.js";
import { emptyNode, h, summaryCard } from "./dom.js";
import { mostCommonFlag, severityLabel } from "./flags.js";
import { formatNumber } from "./format.js";

const heatmap = document.getElementById("patternHeatmap");
const detail = document.getElementById("patternDetail");

export function renderPatternHeatmap(history) {
  const cells = weekdayTimeBuckets(history);
  const populated = cells.filter((cell) => cell.count > 0);

  heatmap.replaceChildren();
  detail.replaceChildren();

  if (!populated.length) {
    heatmap.append(emptyNode("No historical flag records are available."));
    return;
  }

  // Open on the most hazardous window.
  const selected = populated.reduce((best, cell) => (cell.averageSeverity > best.averageSeverity ? cell : best));

  heatmap.append(
    h("div.heatmap-corner"),
    ...TIME_BUCKETS.map((bucket) => h("div.heatmap-axis.heatmap-time", bucket.shortLabel)),
    ...WEEKDAYS.flatMap((weekday) => [
      h("div.heatmap-axis.heatmap-day", weekday.shortLabel),
      ...TIME_BUCKETS.map((bucket) => cellNode(
        cells.find((cell) => cell.weekday === weekday.index && cell.bucket === bucket.start),
        selected
      )),
    ])
  );
  showDetail(selected);
}

function cellNode(cell, selected) {
  if (!cell || cell.count === 0) return h("button.heatmap-cell.empty", { type: "button", disabled: true }, "-");

  const average = formatNumber(cell.averageSeverity, 1);
  const button = h(
    `button.heatmap-cell.level-${Math.min(7, Math.ceil(cell.averageSeverity))}`,
    {
      type: "button",
      "aria-label": `${cell.weekdayLabel} ${cell.bucketLabel}: average hazard ${average} from ${cell.count} readings`,
      onclick: () => {
        heatmap.querySelectorAll(".heatmap-cell").forEach((node) => node.classList.remove("selected"));
        button.classList.add("selected");
        showDetail(cell);
      },
    },
    average
  );

  button.classList.toggle("selected", cell === selected);
  return button;
}

function showDetail(cell) {
  const topFlag = mostCommonFlag(cell.entries);
  detail.replaceChildren(
    summaryCard("Selected window", `${cell.weekdayLabel}, ${cell.bucketLabel}`, `${cell.count} readings`),
    summaryCard("Average hazard", `${formatNumber(cell.averageSeverity, 1)} / 7`, severityLabel(cell.averageSeverity)),
    summaryCard("Most common", topFlag?.label || "No data", topFlag ? `${topFlag.count} readings` : "")
  );
}
