export function statNode(label, value) {
  const item = document.createElement("span");
  item.className = "flag-stat";

  const key = document.createElement("span");
  key.className = "flag-stat-k";
  key.textContent = label;

  const val = document.createElement("span");
  val.className = "flag-stat-v";
  val.textContent = value;

  item.append(key, val);
  return item;
}

export function summaryCard(label, value, detail) {
  const card = document.createElement("article");
  card.className = "summary-card";

  const k = document.createElement("span");
  k.className = "summary-k";
  k.textContent = label;

  const v = document.createElement("strong");
  v.className = "summary-v";
  v.textContent = value || "N/A";

  const d = document.createElement("span");
  d.className = "summary-d";
  d.textContent = detail || "";

  card.append(k, v, d);
  return card;
}

export function emptyNode(message) {
  const node = document.createElement("div");
  node.className = "no-data";
  node.textContent = message;
  return node;
}
