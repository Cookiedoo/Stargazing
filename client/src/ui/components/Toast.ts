let containerEl: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (containerEl && document.body.contains(containerEl)) {
    return containerEl;
  }
  const div = document.createElement("div");
  div.className = "toast-container";
  document.body.appendChild(div);
  containerEl = div;
  return div;
}

export function showToast(message: string, durationMs: number = 2500): void {
  const container = ensureContainer();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add("toast-leaving");
    setTimeout(() => el.remove(), 300);
  }, durationMs);
}
