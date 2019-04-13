import assert from '/lib/assert.js';
import getResources from '/src/db/get-resources.js';
import patchResource from '/src/db/patch-resource.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export default async function archiveResources(conn, maxAge = TWO_DAYS_MS) {
  assert(maxAge >= 0);
  const currentDate = new Date();
  const query = {
    conn,
    mode: 'archivable-entries',
    offset: 0,
    limit: 100
  };

  let resources = await getResources(query);

  while (resources.length) {
    for (const resource of resources) {
      if (resource.created_date && (currentDate - resource.created_date > maxAge)) {
        const deltaTransitions = {
          id: resource.id,
          title: undefined,
          author: undefined,
          enclosure: undefined,
          content: undefined,
          favicon_url: undefined,
          feed_title: undefined,
          archived: 1
        };
        // eslint-disable-next-line no-await-in-loop
        await patchResource(conn, deltaTransitions);
      }
    }

    // Only load more if we read up to the limit last time
    if (resources.length === query.limit) {
      query.offset += query.limit;
      // eslint-disable-next-line no-await-in-loop
      resources = await getResources(query);
    } else {
      resources = [];
    }
  }
}
