import { describe, expect, it } from "vitest";
import { CALM_LAYOUT, computeSky, SKY_VARS, skyWeather, type SkyInput, type SkyLayout } from "./sky";

const PHONE: SkyLayout = { scene: "full", horizon: 25, top: 7, x0: 55, x1: 93, width: 100 };
const base: SkyInput = { minutes: 720, sunrise: 455, sunset: 1100, weather: "clear", dark: false, layout: PHONE };

/** Where the sun or moon is drawn (the first radial gradient of --hz-sky), in %. */
function body(sky: ReturnType<typeof computeSky>) {
  const m = sky.vars["--hz-sky"].match(/circle at ([\d.]+)% ([\d.]+)%/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

describe("skyWeather", () => {
  it("maps weather codes to what the sky shows", () => {
    expect(skyWeather(0)).toBe("clear");
    expect(skyWeather(2)).toBe("partly");
    expect(skyWeather(3)).toBe("overcast");
    expect(skyWeather(45)).toBe("fog");
    expect(skyWeather(61)).toBe("rain");
    expect(skyWeather(81)).toBe("rain");
    expect(skyWeather(73)).toBe("snow");
    expect(skyWeather(86)).toBe("snow");
    expect(skyWeather(95)).toBe("storm");
    expect(skyWeather(null)).toBe("clear");
  });
});

describe("computeSky", () => {
  it("moves the sun from the left over the top to the right during the day", () => {
    const morning = body(computeSky({ ...base, minutes: 520 }))!;
    const noon = body(computeSky({ ...base, minutes: 777 }))!;
    const evening = body(computeSky({ ...base, minutes: 1040 }))!;
    expect(morning.x).toBeLessThan(noon.x);
    expect(noon.x).toBeLessThan(evening.x);
    expect(noon.y).toBeLessThan(morning.y);
    expect(noon.y).toBeLessThan(evening.y);
    // Within its path, clear of the clock.
    for (const p of [morning, noon, evening]) {
      expect(p.x).toBeGreaterThanOrEqual(55);
      expect(p.x).toBeLessThanOrEqual(93);
    }
  });

  it("puts the sun below the horizon just before sunrise, and shows stars only at night", () => {
    const dawn = computeSky({ ...base, minutes: 440 });
    expect(body(dawn)!.y).toBeGreaterThan(PHONE.horizon);
    expect(dawn.isDay).toBe(true);
    expect(dawn.vars["--hz-stars"]).toBe("0");
    const night = computeSky({ ...base, minutes: 1390, dark: true });
    expect(night.isDay).toBe(false);
    expect(Number(night.vars["--hz-stars"])).toBeGreaterThan(0);
    expect(body(night)!.y).toBeLessThan(PHONE.horizon);
  });

  it("follows the weather: rain and snow, no stars behind clouds", () => {
    const rain = computeSky({ ...base, weather: "rain" });
    expect(Number(rain.vars["--hz-rain"])).toBeGreaterThan(0);
    expect(rain.vars["--hz-snow"]).toBe("0");
    expect(rain.vars["--hz-clouds"]).toContain("ellipse");
    const snow = computeSky({ ...base, weather: "snow" });
    expect(Number(snow.vars["--hz-snow"])).toBeGreaterThan(0);
    expect(computeSky({ ...base, minutes: 1390, weather: "overcast" }).vars["--hz-stars"]).toBe("0");
    expect(computeSky(base).vars["--hz-clouds"]).not.toContain("ellipse");
    // Fog lies over the horizon.
    expect(computeSky({ ...base, weather: "fog" }).vars["--hz-haze"]).toContain("25%");
  });

  it("changes colour through the day and between light and dark", () => {
    const at = (minutes: number, dark = false) => computeSky({ ...base, minutes, dark }).vars["--accent"];
    expect(at(450)).not.toBe(at(777));
    expect(at(1070)).not.toBe(at(777));
    expect(at(777, true)).not.toBe(at(777));
  });

  it("keeps other pages calm: no sun disc, no ground", () => {
    const calm = computeSky({ ...base, layout: CALM_LAYOUT });
    expect(calm.vars["--hz-sky"]).not.toContain("circle at");
    expect(calm.vars["--hz-ground"]).toBe("linear-gradient(transparent, transparent)");
    expect(computeSky(base).vars["--hz-ground"]).toContain("transparent 16%");
  });

  it("sets exactly the variables it lists for clean-up", () => {
    expect(Object.keys(computeSky(base).vars).sort()).toEqual([...SKY_VARS].sort());
  });
});
