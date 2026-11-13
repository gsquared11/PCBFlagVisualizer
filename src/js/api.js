import { API } from "./config.js";

export async function apiGet(url, params = {}) {
  const endpoint = new URL(url, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      endpoint.searchParams.set(key, value);
    }
  });

  const response = await fetch(endpoint.pathname + endpoint.search);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload;
}

// Every flag reading on record. The calendar and the charts share one copy.
let history = [];

export const getHistory = () => history;

export async function loadHistory() {
  history = (await apiGet(API.flagHistory)) || history;
  return history;
}
