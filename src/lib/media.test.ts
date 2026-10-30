import { describe, expect, it } from "vitest";
import {
  cleanFilmTitle,
  episodeLink,
  episodesUpTo,
  isAired,
  nextEpisode,
  nextFromWatched,
  parseMediaLine,
  plainText,
  sourcesOf,
  titleFromLink,
  toEpisodeTemplate,
  yearFromText,
} from "./media";

const eps = [
  { season: 1, number: 1 },
  { season: 1, number: 2 },
  { season: 1, number: 3 },
  { season: 2, number: 1 },
  { season: 2, number: 2 },
];

describe("episode links", () => {
  it("turns a link to one episode into one for any episode", () => {
    const template = toEpisodeTemplate(
      "https://stream.example/watchseries/bobs-burgers-online-free/season/1/episode/1",
    );
    expect(template).toBe(
      "https://stream.example/watchseries/bobs-burgers-online-free/season/{season}/episode/{episode}",
    );
    expect(episodeLink(template!, 3, 12)).toBe(
      "https://stream.example/watchseries/bobs-burgers-online-free/season/3/episode/12",
    );
  });

  it("knows the usual other forms, keeping two-digit numbers", () => {
    expect(toEpisodeTemplate("https://example.com/show/south-park-s01e01")).toBe(
      "https://example.com/show/south-park-s{season2}e{episode2}",
    );
    expect(episodeLink("https://example.com/show/south-park-s{season2}e{episode2}", 2, 5)).toBe(
      "https://example.com/show/south-park-s02e05",
    );
    expect(toEpisodeTemplate("https://example.com/tv/simpsons-1x01.html")).toBe(
      "https://example.com/tv/simpsons-{season}x{episode2}.html",
    );
    expect(toEpisodeTemplate("https://example.com/watch?season=4&episode=7")).toBe(
      "https://example.com/watch?season={season}&episode={episode}",
    );
    expect(toEpisodeTemplate("https://stream.example/movie/187769-watch-the-substance-2024-online")).toBeNull();
  });
});

describe("reading pasted links", () => {
  it("recognises a series by its episode link and finds its name", () => {
    const line = parseMediaLine("https://stream.example/watchseries/south-park-online-free/season/1/episode/1");
    expect(line).toMatchObject({
      kind: "series",
      name: null,
      query: "south park",
      source: {
        label: "stream.example",
        url: "https://stream.example/watchseries/south-park-online-free/season/{season}/episode/{episode}",
      },
    });
  });

  it("recognises films with their year", () => {
    expect(parseMediaLine("https://stream.example/movie/187769-watch-the-substance-2024-online")).toMatchObject({
      kind: "movie",
      query: "the substance",
      year: 2024,
    });
    expect(titleFromLink("https://stream.example/movie/53577-watch-american-beauty-1999-online")).toEqual({
      query: "american beauty",
      year: 1999,
    });
  });

  it("takes a name written before the link, for live TV and plain links", () => {
    expect(parseMediaLine("ZDF https://famelack.com/tv/de/zdf123")).toMatchObject({
      kind: "channel",
      name: "ZDF",
      source: { url: "https://famelack.com/tv/de/zdf123" },
    });
    expect(parseMediaLine("Das Erste – https://famelack.com/tv/de/erste123")?.name).toBe("Das Erste");
    expect(parseMediaLine("https://yarrlist.net/")).toMatchObject({
      kind: "link",
      name: null,
      source: { label: "yarrlist.net" },
    });
    expect(parseMediaLine("no link here")).toBeNull();
    expect(parseMediaLine("javascript:alert(1)")).toBeNull();
  });

  it("keeps only web links from stored sources", () => {
    expect(
      sourcesOf([
        { label: "A", url: "https://a.example/x" },
        { label: "B", url: "javascript:alert(1)" },
        { url: "https://www.c.example/" },
        "nonsense",
      ]),
    ).toEqual([
      { label: "A", url: "https://a.example/x" },
      { label: "c.example", url: "https://www.c.example/" },
    ]);
  });
});

describe("progress", () => {
  it("goes on after the furthest episode seen", () => {
    expect(nextEpisode(eps, [])).toEqual({ season: 1, number: 1 });
    expect(nextEpisode(eps, ["1:1", "1:2", "1:3"])).toEqual({ season: 2, number: 1 });
    // A skipped episode doesn't hold you back.
    expect(nextEpisode(eps, ["1:1", "2:1"])).toEqual({ season: 2, number: 2 });
    expect(nextEpisode(eps, ["2:2"])).toBeNull();
  });

  it("works without an episode list too", () => {
    expect(nextFromWatched([])).toEqual({ season: 1, number: 1 });
    expect(nextFromWatched(["1:2", "1:10", "1:3"])).toEqual({ season: 1, number: 11 });
  });

  it("marks everything up to an episode", () => {
    expect(episodesUpTo(eps, { season: 2, number: 1 })).toEqual(["1:1", "1:2", "1:3", "2:1"]);
  });

  it("knows what has aired", () => {
    expect(isAired({ airdate: "2026-10-01" }, "2026-10-30")).toBe(true);
    expect(isAired({ airdate: "2026-11-01" }, "2026-10-30")).toBe(false);
    expect(isAired({ airdate: null }, "2026-10-30")).toBe(true);
  });
});

describe("texts from the lookups", () => {
  it("shows summaries as plain text", () => {
    expect(plainText("<p>Bob &amp; Linda's <b>restaurant</b> &#39;opens&#39;.</p><p>Again.</p>")).toBe(
      "Bob & Linda's restaurant 'opens'.\n\nAgain.",
    );
    expect(plainText("<script>alert(1)</script>")).toBe("alert(1)");
    expect(plainText("")).toBeNull();
  });

  it("cleans film titles and finds years", () => {
    expect(cleanFilmTitle("American Beauty (1999 film)")).toBe("American Beauty");
    expect(cleanFilmTitle("The Substance (film)")).toBe("The Substance");
    expect(yearFromText("1999 film by Sam Mendes")).toBe(1999);
    expect(yearFromText(null)).toBeNull();
  });
});
