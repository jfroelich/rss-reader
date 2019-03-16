import update_feed from '/src/db/ops/update-feed.js';

// Update the feed corresponding to the given id to the active feed state
// @param conn {IDBDatabase}
// @param channel {BroadcastChannel}
// @param id {Number}
// @return {Promise}
export default function activate_feed(conn, channel, id) {
  const props = {
    id: id,
    active: true,
    deactivateDate: undefined,
    deactivationReasonText: undefined
  };

  const overwrite_flag = false;
  return update_feed(conn, channel, props, overwrite_flag);
}