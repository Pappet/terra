/**
 * Kleine DOM-Bausteine (M10.0). Kein Zustand, keine Sim-Kenntnis – nur
 * Elementfabriken, damit die Panels nicht jeweils eigenes createElement-
 * Rauschen mitschleppen.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, onClick: () => void, title?: string): HTMLButtonElement {
  const b = el('button', undefined, label);
  if (title !== undefined) b.title = title;
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export function sectionTitle(text: string): HTMLDivElement {
  return el('div', 'section-title', text);
}

/** Kennzahlen-Liste: Beschriftung links, Wert rechtsbündig monospace. */
export class KeyValueList {
  readonly root = el('dl', 'kv');
  private readonly values = new Map<string, HTMLElement>();

  /** Legt eine Zeile an (idempotent) und setzt ihren Wert. */
  set(label: string, value: string, valueClass = ''): void {
    let dd = this.values.get(label);
    if (dd === undefined) {
      this.root.append(el('dt', undefined, label));
      dd = el('dd');
      this.root.append(dd);
      this.values.set(label, dd);
    }
    dd.textContent = value;
    dd.className = valueClass;
  }

  clear(): void {
    this.root.replaceChildren();
    this.values.clear();
  }
}

/** Fortschritts-/Anteilsbalken 0..1. */
export function bar(value01: number, color?: string): HTMLDivElement {
  const outer = el('div', 'bar');
  const inner = el('span');
  inner.style.width = `${Math.round(Math.max(0, Math.min(1, value01)) * 100)}%`;
  if (color !== undefined) inner.style.background = color;
  outer.append(inner);
  return outer;
}

/** Anklickbare Listenzeile mit Haupttext links und Kennzahl rechts. */
export function listRow(
  main: string,
  meta: string,
  onClick: () => void,
  active = false,
): HTMLDivElement {
  const row = el('div', `list-row${active ? ' active' : ''}`);
  row.append(el('span', 'list-main', main), el('span', 'list-meta', meta));
  row.addEventListener('click', onClick);
  return row;
}

export function swatch(color: string): HTMLSpanElement {
  const s = el('span', 'swatch');
  s.style.background = color;
  return s;
}

export function hint(text: string): HTMLDivElement {
  return el('div', 'options-hint', text);
}
