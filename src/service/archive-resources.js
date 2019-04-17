import * as db from '/src/db/db.js';
import * as rss from '/src/service/resource-storage-service.js';
import assert from '/src/lib/assert.js';

// TODO: now that this module lies within the services layer, it seems like it would be better to
// name the module more specifically to its purpose, which is archiving entries, not all resources,
// so rename this to archive-entries.

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export default async function archiveResources(conn, maxAge = TWO_DAYS_MS) {
  assert(maxAge >= 0);
  const currentDate = new Date();
  const query = {
    mode: 'archivable-entries',
    offset: 0,
    limit: 100
  };

  const archivedResourceIds = [];

  let resources = await rss.getEntries(conn, query);

  while (resources.length) {
    for (const resource of resources) {
      if (resource.created_date && (currentDate - resource.created_date > maxAge)) {
        archivedResourceIds.push(resource.id);
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
        await db.patchResource(conn, deltaTransitions);
      }
    }

    // Only load more if we read up to the limit last time
    if (resources.length === query.limit) {
      query.offset += query.limit;
      // eslint-disable-next-line no-await-in-loop
      resources = await rss.getEntries(conn, query);
    } else {
      resources = [];
    }
  }

  return archivedResourceIds;
}
