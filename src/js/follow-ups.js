import { flagFollowUps, flagRuns } from "./analytics.js";
import { emptyNode, flagKeyNode, h, summaryCard } from "./dom.js";
import { formatDuration, formatInteger } from "./format.js";

const picker = document.getElementById("followUpPicker");
const summary = document.getElementById("followUpSummary");
const bars = document.getElementById("followUpBars");

let selectedLabel = null;

export function renderFollowUps(history) {
  const runs = flagRuns(history);
  const groups = flagFollowUps(runs).filter((group) => group.completed > 0);

  picker.replaceChildren(...groups.map((group) => flagKeyNode(group.flag, "", () => select(group))));
  summary.replaceChildren();
  bars.replaceChildren();

  if (!groups.length) {
    bars.append(emptyNode("Not enough flag changes are on record yet."));
    return;
  }

  // Keep the reader's choice across refreshes; otherwise open on the flag flying now.
  const currentLabel = runs[runs.length - 1].flag.label;
  select(
    groups.find((group) => group.flag.label === selectedLabel) ||
    groups.find((group) => group.flag.label === currentLabel) ||
    groups[0]
  );
}

function select(group) {
  selectedLabel = group.flag.label;
  picker.querySelectorAll(".flag-key").forEach((key) => {
    key.setAttribute("aria-pressed", String(key.dataset.flag === group.flag.className));
  });

  const [mostLikely] = group.next;
  const { longest } = group;
  summary.replaceChildren(
    summaryCard("Typical", formatDuration(group.medianHours), `median of ${formatInteger(group.completed)}`),
    summaryCard("Longest", formatDuration(longest.hours), `${longest.start.toFormat("LLL d")} to ${longest.end.toFormat("LLL d, yyyy")}`),
    summaryCard("Replaced by", mostLikely.flag.label, `${Math.round(mostLikely.share * 100)}% of the time`)
  );

  const fills = [];
  bars.replaceChildren(...group.next.map((item) => {
    const fill = h("span.follow-up-fill", { dataset: { share: (item.share * 100).toFixed(1) } });
    fills.push(fill);
    return h(
      `li.follow-up-row.${item.flag.className}`,
      h("span.follow-up-label", item.flag.label),
      h("span.follow-up-track", fill),
      h("span.follow-up-value", `${Math.round(item.share * 100)}% (${formatInteger(item.count)})`)
    );
  }));

  // Set the widths a frame later so the bars grow from zero.
  window.requestAnimationFrame(() => fills.forEach((fill) => { fill.style.width = `${fill.dataset.share}%`; }));
}
