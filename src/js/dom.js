// h("li.flag-entry", { dataset: { flagType }, onclick }, child, "text") builds an element in one call.
// Classes come from the selector; null and false children are skipped.
export function h(selector, ...args) {
  const [tag, ...classes] = selector.split(".");
  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(" ");

  args.flat().forEach((arg) => {
    if (arg == null || arg === false) return;
    if (arg instanceof Node || typeof arg !== "object") node.append(arg);
    else setProps(node, arg);
  });

  return node;
}

function setProps(node, props) {
  Object.entries(props).forEach(([key, value]) => {
    if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "style") Object.entries(value).forEach(([name, v]) => node.style.setProperty(name, v));
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  });
}

export function statNode(label, value) {
  return h("span.flag-stat", h("span.flag-stat-k", label), h("span.flag-stat-v", value));
}

export function summaryCard(label, value, detail) {
  return h("article.summary-card", h("span.summary-k", label), h("strong.summary-v", value || "N/A"), h("span.summary-d", detail || ""));
}

export function flagKeyNode(flag, detail, onClick) {
  return h(
    `button.flag-key.${flag.className}`,
    { type: "button", dataset: { flag: flag.className }, "aria-pressed": "false", onclick: onClick },
    h("span.flag-key-swatch"),
    h("span", flag.label === "No Flag" ? "No flag" : flag.label.replace(" Flag", "")),
    detail !== "" && h("span.flag-key-count", detail)
  );
}

export function emptyNode(message) {
  return h("div.no-data", message);
}

const errorContainer = document.getElementById("errorContainer");

export function showError(message) {
  errorContainer.textContent = message;
  errorContainer.classList.remove("hidden");
}

export function hideError() {
  errorContainer.classList.add("hidden");
  errorContainer.textContent = "";
}
