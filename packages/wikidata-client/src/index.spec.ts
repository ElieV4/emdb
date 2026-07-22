import { getWikipediaUrlFromWikidataId } from './index';

describe('wikidata-client', () => {
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        entities: {
          Q12345: {
            sitelinks: {
              frwiki: { url: 'https://fr.wikipedia.org/wiki/Test' },
            },
          },
        },
      }),
    } as any));
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('doit retourner l URL Wikipedia pour un wikidataId', async () => {
    const url = await getWikipediaUrlFromWikidataId('Q12345', 'fr');
    expect(url).toBe('https://fr.wikipedia.org/wiki/Test');
  });
});
