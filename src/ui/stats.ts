/**
 * Statistik-Panel (M7.5): Zeitreihen-Liniendiagramme (Kasse, Einwohner,
 * Zufriedenheit) aus world.history — minimales Canvas, keine Library.
 */
export class StatsPanel {
  private readonly panel: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private visible = false;

  constructor(parent: HTMLElement = document.body) {
    this.panel = document.createElement('div');
    this.panel.className = 'panel stats-panel';
    this.panel.style.display = 'none';
    this.canvas = document.createElement('canvas');
    this.canvas.width = 340;
    this.canvas.height = 220;
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('Stats-Kontext nicht verfügbar');
    this.ctx = ctx;
    this.panel.append(this.canvas);
    parent.append(this.panel);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? '' : 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** Pro Frame (oder seltener) aufrufen; zeichnet nur bei Sichtbarkeit. */
  draw(history: { tick: number[]; treasury: number[]; residents: number[]; satisfaction: number[] }): void {
    if (!this.visible) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(10, 12, 16, 0.95)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '11px monospace';
    ctx.fillStyle = '#7d8894';
    ctx.fillText('Zeitreihen (letzte 200 Intervalle)', 10, 14);

    const series: Array<{ data: number[]; color: string; label: string }> = [
      { data: history.treasury, color: '#ffd27a', label: 'Kasse' },
      { data: history.residents, color: '#7ec8ff', label: 'Einwohner' },
      { data: history.satisfaction.map((v) => v * 100), color: '#9ecb7a', label: 'Zufriedenheit %' },
    ];

    const all = series.flatMap((s) => s.data);
    if (all.length < 2) {
      ctx.fillStyle = '#7d8894';
      ctx.fillText('Noch zu wenig Daten (1 Intervall = 10 s bei 1x)', 10, 40);
      return;
    }
    const min = Math.min(0, ...all);
    const max = Math.max(1, ...all);
    const plotX = 10;
    const plotY = 24;
    const plotW = W - 20;
    const plotH = H - 40;
    const n = Math.max(history.tick.length, 2);

    let legendX = 10;
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < s.data.length; i++) {
        const x = plotX + (i / (n - 1)) * plotW;
        const y = plotY + plotH - ((s.data[i] ?? 0) - min) / (max - min) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = s.color;
      ctx.fillText(s.label, legendX, H - 6);
      legendX += ctx.measureText(s.label).width + 14;
    }
  }
}
