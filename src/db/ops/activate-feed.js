import patch_feed from '/src/db/ops/patch-feed.js';

// TODO: now that this is so simple, deprecate

// Set the feed corresponding to the given id to the active feed state
export default function activate_feed(conn, id) {
  return patch_feed(conn, {
    id: id,
    active: true,
    deactivation_date: undefined,
    deactivation_reason: undefined
  });
}
