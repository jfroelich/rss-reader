import update_feed from '/src/db/ops/update-feed.js';

// Update the feed corresponding to the given id to the active feed state
// @param conn {Connection}
// @param id {Number}
// @return {Promise}
export default function activate_feed(conn, id) {
  const props = {
    id: id,
    active: true,
    deactivate_date: undefined,
    deactivation_reason_text: undefined
  };

  const overwrite_flag = false;
  return update_feed(conn, props, overwrite_flag);
}
