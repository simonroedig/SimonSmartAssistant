/** Something with a name to search for (an installed app). */
type Named = { label: string };

/**
 * Apps whose name contains `term` (lower case), the best first: the exact name,
 * then names starting with it, then a word starting with it, then the rest – so
 * an app called just "X" comes first, however many names contain an x.
 */
export function rankApps<T extends Named>(apps: T[], term: string): T[] {
  const rank = (label: string) => {
    const name = label.toLowerCase();
    if (name === term) return 0;
    if (name.startsWith(term)) return 1;
    if (name.split(/[\s._-]+/).some((word) => word.startsWith(term))) return 2;
    return 3;
  };
  return apps
    .filter((a) => a.label.toLowerCase().includes(term))
    .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, "de", { sensitivity: "base" }));
}
