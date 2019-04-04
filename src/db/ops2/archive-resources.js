import get_resources from '/src/db/ops2/get-resources.js';
import patch_resource from '/src/db/ops2/patch-resource.js';
import assert from '/src/lib/assert.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export default async function archive_resources(conn, max_age = TWO_DAYS_MS) {
  assert(max_age >= 0);
  const current_date = new Date();
  const query = {
    conn: conn,
    mode: 'archivable-entries',
    offset: 0,
    limit: 100,
  };

  let resources = await get_resources(query);

  while (resources.length) {
    for (const resource of resources) {
      if (resource.created_date &&
          (current_date - resource.created_date > max_age)) {
        const delta_transitions = {
          id: resource.id,
          title: undefined,
          author: undefined,
          enclosure: undefined,
          content: undefined,
          favicon_url: undefined,
          feed_title: undefined,
          archived: 1
        };
        await patch_resource(conn, delta_transitions);
      }
    }

    // Only load more if we read up to the limit last time
    if (resources.length === query.limit) {
      query.offset += query.limit;
      resources = await get_resources(query);
    } else {
      resources = [];
    }
  }
}
