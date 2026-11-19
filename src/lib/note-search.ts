/** Lower case, without accents: "Café" finds "cafe" and the other way round. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The search's words (each must appear somewhere – in any order). */
export function searchTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Whether every word of the search is found in one of the texts. */
export function matchesSearch(terms: string[], ...texts: (string | null | undefined)[]): boolean {
  if (terms.length === 0) return false;
  const haystack = fold(texts.filter(Boolean).join("\n"));
  return terms.every((term) => haystack.includes(term));
}
