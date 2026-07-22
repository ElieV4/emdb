export async function getWikipediaUrlFromWikidataId(
  wikidataId: string,
  lang = 'fr',
): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
    wikidataId,
  )}&props=sitelinks/urls&format=json&formatversion=2`;

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Wikidata request failed ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as any;
  const siteLinks = json.entities?.[wikidataId]?.sitelinks;

  if (!siteLinks) {
    return null;
  }

  const siteKey = `${lang}wiki`;
  return siteLinks[siteKey]?.url ?? null;
}
