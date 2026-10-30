/**
 * A poster's own colour: the hue that most of its colourful pixels share (not
 * the average, which turns every poster brown), brought to a lightness that
 * works for buttons and text in light and dark.
 */

type Rgb = [number, number, number];

const HUE_BUCKETS = 24;

function hsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function rgbFromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The dominant colour of raw RGB pixels (3 bytes each), as #rrggbb – or null when
 * the picture has no clear colour (black and white, greys).
 */
export function dominantColor(pixels: ArrayLike<number>): string | null {
  const weight = new Array<number>(HUE_BUCKETS).fill(0);
  const sums = Array.from({ length: HUE_BUCKETS }, () => [0, 0, 0, 0]);
  let total = 0;
  for (let i = 0; i + 2 < pixels.length; i += 3) {
    const rgb: Rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const [h, s, l] = hsl(rgb);
    total++;
    // Near black, near white and greys say nothing about the poster's colour.
    if (l < 0.08 || l > 0.92 || s < 0.25) continue;
    const bucket = Math.floor(h / (360 / HUE_BUCKETS)) % HUE_BUCKETS;
    // Vivid, mid-light pixels count most.
    const w = s * (1 - Math.abs(l - 0.5) * 1.2);
    weight[bucket] += w;
    sums[bucket][0] += rgb[0] * w;
    sums[bucket][1] += rgb[1] * w;
    sums[bucket][2] += rgb[2] * w;
    sums[bucket][3] += w;
  }
  // A neighbouring hue belongs to the same colour (an orange split over two buckets).
  let best = -1;
  let bestWeight = 0;
  for (let i = 0; i < HUE_BUCKETS; i++) {
    const w = weight[i] + 0.5 * (weight[(i + 1) % HUE_BUCKETS] + weight[(i + HUE_BUCKETS - 1) % HUE_BUCKETS]);
    if (w > bestWeight) {
      bestWeight = w;
      best = i;
    }
  }
  // Too few colourful pixels: no colour of its own.
  if (best < 0 || total === 0 || weight[best] / total < 0.04) return null;
  const [r, g, b, w] = sums[best];
  const [h, s, l] = hsl([r / w, g / w, b / w].map(Math.round) as Rgb);
  // Strong enough to be a button, light/dark enough for text in either theme.
  return toHex(rgbFromHsl(h, Math.max(0.5, Math.min(0.9, s)), Math.max(0.42, Math.min(0.6, l))));
}

/** White or black text on a colour: white unless black reads clearly better (WCAG contrast). */
export function textOn(hex: string): "#ffffff" | "#111111" {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const onWhite = 1.05 / (luminance + 0.05);
  const onBlack = (luminance + 0.05) / 0.05;
  return onWhite >= onBlack * 0.6 ? "#ffffff" : "#111111";
}
