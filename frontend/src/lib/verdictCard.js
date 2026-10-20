// Draws a shareable verdict card (PNG) on a canvas, then shares it (Web Share API) or downloads it.
import { prob } from "./format.js";

const W = 1080, H = 1350;
const C = { page: "#f5f8f6", panel: "#ffffff", line: "#e1e9e6", ink: "#1f2b2d", muted: "#687a7d", teal: "#0b7a6c",
  real: "#138a5a", real50: "#e5f6ed", ai: "#d6334f", ai50: "#fdedf0" };

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, x, y, maxWidth, lineHeight) {
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}

/** Returns a PNG Blob of the card. */
export async function drawVerdictCard({ result, lang, sourceLabel }) {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily;
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d");
  const ai = result.label === "spoof";
  const tone = ai ? C.ai : C.real;

  ctx.fillStyle = C.page;
  ctx.fillRect(0, 0, W, H);
  // soft sound-wave pattern
  ctx.strokeStyle = "rgba(11, 122, 108, 0.06)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (let x = 40; x < W; x += 36) {
    const h = 20 + 60 * Math.abs(Math.sin(x * 0.021));
    ctx.beginPath(); ctx.moveTo(x, 110 - h / 2); ctx.lineTo(x, 110 + h / 2); ctx.stroke();
  }

  ctx.fillStyle = C.teal;
  ctx.font = `700 40px ${font}`;
  ctx.fillText("FakeAudio Shield", 80, 125);

  rounded(ctx, 60, 200, W - 120, H - 330, 44);
  ctx.fillStyle = C.panel; ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 3; ctx.stroke();

  ctx.fillStyle = C.muted;
  ctx.font = `600 30px ${font}`;
  ctx.fillText("VOICE CHECK", 120, 300);

  ctx.fillStyle = tone;
  ctx.font = `750 84px ${font}`;
  let y = wrap(ctx, ai ? "Likely AI-generated" : "Likely a real voice", 120, 400, W - 240, 96);

  ctx.fillStyle = C.ink;
  ctx.font = `700 150px ${font}`;
  ctx.fillText(`${prob(result.confidence)}%`, 120, y + 120);
  ctx.fillStyle = C.muted;
  ctx.font = `500 34px ${font}`;
  ctx.fillText("confidence", 120, y + 175);
  y += 250;

  // real <-> AI meter
  const mx = 120, mw = W - 240, my = y;
  rounded(ctx, mx, my, mw, 22, 11);
  const grad = ctx.createLinearGradient(mx, 0, mx + mw, 0);
  grad.addColorStop(0, C.real); grad.addColorStop(0.5, "#f2c14e"); grad.addColorStop(1, C.ai);
  ctx.fillStyle = grad; ctx.fill();
  const kx = mx + mw * result.probabilities.spoof;
  ctx.beginPath(); ctx.arc(kx, my + 11, 24, 0, Math.PI * 2);
  ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.stroke();
  ctx.font = `600 28px ${font}`;
  ctx.fillStyle = C.real; ctx.fillText("Real", mx, my + 80);
  ctx.fillStyle = C.ai; ctx.textAlign = "right"; ctx.fillText("AI", mx + mw, my + 80); ctx.textAlign = "left";
  y = my + 150;

  // timeline of parts
  const segs = result.segments ?? [];
  const total = segs.length ? segs[segs.length - 1].end : 1;
  let sx = 120;
  for (const s of segs) {
    const w = Math.max(30, ((s.end - s.start) / total) * (W - 240)) - 8;
    rounded(ctx, sx, y, w, 64, 14);
    ctx.fillStyle = s.spoof_probability >= 0.5 ? C.ai50 : C.real50; ctx.fill();
    ctx.fillStyle = s.spoof_probability >= 0.5 ? C.ai : C.real;
    ctx.font = `700 26px ${font}`;
    if (w > 70) ctx.fillText(`${prob(s.spoof_probability)}%`, sx + 16, y + 42);
    sx += w + 8;
  }
  y += 130;

  ctx.fillStyle = C.ink;
  ctx.font = `600 32px ${font}`;
  ctx.fillText(`Language: ${lang}   ·   Model: ${result.model ?? "LCNN"}`, 120, y);
  ctx.fillStyle = C.muted;
  ctx.font = `500 28px ${font}`;
  wrap(ctx, `${sourceLabel} · ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`, 120, y + 52, W - 240, 38);

  ctx.fillStyle = C.muted;
  ctx.font = `500 28px ${font}`;
  ctx.fillText("A prediction to support your judgement, not proof.", 80, H - 70);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Share through the system share sheet when possible, otherwise download. */
export async function shareVerdictCard(opts) {
  const blob = await drawVerdictCard(opts);
  const file = new File([blob], `voice-check-${opts.result.label === "spoof" ? "ai" : "real"}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "FakeAudio Shield voice check" });
      return "shared";
    } catch (e) {
      if (e.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: file.name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
