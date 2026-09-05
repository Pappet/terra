/**
 * Zeitreihen-Diagramm (aus M7.5 übernommen, in M10.0 vom Panel zur reinen
 * Zeichenfunktion entkoppelt: das Diagramm hängt jetzt im Statistik-Tab).
 * Minimales Canvas, keine Library.
 */

export interface HistorySeries {
  readonly tick: number[];
  readonly treasury: number[];
  readonly residents: number[];
  readonly satisfaction: number[];
}

/** Farben spiegeln die Tokens; Canvas kann keine CSS-Variablen lesen. */
const COLORS = {
  bg: '#0b0d10',
  muted: '#8391a0',
  treasury: '#e0a83c',
  residents: '#7ec8ff',
  satisfaction: '#7fbf6a',
} as const;

export function drawHistoryChart(canvas: HTMLCanvasElement, history: HistorySeries): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.font = '11px ui-monospace, monospace';

  const series: Array<{ data: number[]; color: string; label: string }> = [
    { data: history.treasury, color: COLORS.treasury, label: 'Kasse' },
    { data: history.residents, color: COLORS.residents, label: 'Einwohner' },
    { data: history.satisfaction.map((v) => v * 100), color: COLORS.satisfaction, label: 'Zufriedenheit %' },
  ];

  const all = series.flatMap((s) => s.data);
  if (all.length < 2) {
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('Noch zu wenig Daten (1 Intervall = 10 s bei 1x)', 8, 20);
    return;
  }

  const min = Math.min(0, ...all);
  const max = Math.max(1, ...all);
  const plotX = 6;
  const plotY = 8;
  const plotW = W - 12;
  const plotH = H - 30;
  const n = Math.max(history.tick.length, 2);

  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < s.data.length; i++) {
      const x = plotX + (i / (n - 1)) * plotW;
      const y = plotY + plotH - (((s.data[i] ?? 0) - min) / (max - min)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  let legendX = 6;
  for (const s of series) {
    ctx.fillStyle = s.color;
    ctx.fillText(s.label, legendX, H - 6);
    legendX += ctx.measureText(s.label).width + 12;
  }
}
