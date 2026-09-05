/**
 * Werkzeug-Rail (M10.0): senkrechte Leiste am linken Rand, rendert aus
 * data/tools.ts. Kennt nur Werkzeug-IDs, keine Actions.
 */
import { TOOLS, type ToolId } from '../data/tools';
import { el } from './widgets';

export class ToolRail {
  private readonly buttons = new Map<ToolId, HTMLButtonElement>();

  constructor(host: HTMLElement, onTool: (id: ToolId) => void) {
    const rail = el('div', 'rail');
    for (const tool of TOOLS) {
      if (tool.separatorBefore === true) {
        rail.append(el('div', 'rail-spacer'), el('div', 'rail-separator'));
      }
      const b = el('button', undefined, tool.icon);
      b.type = 'button';
      b.title = `${tool.name} [${tool.shortcut}] – ${tool.hint}`;
      b.setAttribute('aria-label', tool.name);
      b.addEventListener('click', () => onTool(tool.id));
      this.buttons.set(tool.id, b);
      rail.append(b);
    }
    host.append(rail);
  }

  setActive(id: ToolId): void {
    for (const [toolId, b] of this.buttons) b.classList.toggle('active', toolId === id);
  }
}
