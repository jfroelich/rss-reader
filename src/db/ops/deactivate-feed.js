import patch_feed from '/src/db/ops/patch-feed.js';

// TODO: now that this is so simple, deprecate

export default function deactivate_feed(conn, id, reason) {
  return patch_feed(conn, {
    id: id,
    active: false,
    deactivation_date: new Date(),
    deactivation_reason: reason
  });
}
