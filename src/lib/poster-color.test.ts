import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { dominantColor, textOn } from "./poster-color";

/** Raw RGB pixels: `n` of each colour. */
function pixels(...parts: [number, [number, number, number]][]) {
  return parts.flatMap(([n, rgb]) => Array.from({ length: n }, () => rgb).flat());
}

const hue = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  return max === r ? "red-ish" : max === g ? "green-ish" : "blue-ish";
};

describe("a poster's colour", () => {
  it("is the colour most of its colourful pixels share – not their average", () => {
    // Lots of black and white, a big yellow area, a little blue.
    const color = dominantColor(
      pixels([400, [0, 0, 0]], [300, [255, 255, 255]], [250, [240, 200, 30]], [50, [30, 60, 200]]),
    );
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color!.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b + 80);
    expect(g).toBeGreaterThan(b + 60);
  });

  it("has none when the picture is black and white", () => {
    expect(dominantColor(pixels([500, [10, 10, 10]], [500, [200, 200, 200]], [10, [200, 30, 30]]))).toBeNull();
  });

  it("is never too dark or too pale for a button", () => {
    const deep = dominantColor(pixels([100, [60, 0, 0]]))!;
    const [r] = [parseInt(deep.slice(1, 3), 16)];
    expect(r).toBeGreaterThan(150);
  });

  it("works on a real image", async () => {
    // A red poster with a black title band.
    const red = await sharp({ create: { width: 30, height: 45, channels: 3, background: { r: 210, g: 40, b: 30 } } })
      .composite([
        {
          input: await sharp({ create: { width: 30, height: 10, channels: 3, background: "#000" } })
            .png()
            .toBuffer(),
          top: 30,
          left: 0,
        },
      ])
      .removeAlpha()
      .raw()
      .toBuffer();
    expect(hue(dominantColor(red)!)).toBe("red-ish");
  });

  it("gets readable text on top", () => {
    expect(textOn("#d02a1e")).toBe("#ffffff");
    expect(textOn("#f2c230")).toBe("#111111");
  });
});
