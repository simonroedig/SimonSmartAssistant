import type { DesignId } from "./device";

/**
 * The design systems to choose from (Settings → This device → Design). The
 * same layout and parts everywhere – each design restyles them through the
 * tokens and hooks in src/app/designs.css. All work in light and dark.
 */
export const DESIGNS: { id: DesignId; name: string; description: string }[] = [
  { id: "aurora", name: "Aurora", description: "Soft glass on a colour glow that follows the time of day" },
  {
    id: "studio",
    name: "Studio",
    description: "Crisp and minimal: solid surfaces, hairline edges, a soft spotlight",
  },
  {
    id: "tactile",
    name: "Tactile",
    description: "Neumorphic: raised cards, pressed-in fields, buttons you want to push",
  },
  { id: "block", name: "Block", description: "Gentle neo-brutalism: bold outlines, hard shadows, flat colour" },
  { id: "doodle", name: "Doodle", description: "Playful paper: wobbly lines, colour splashes, a handwritten touch" },
];
