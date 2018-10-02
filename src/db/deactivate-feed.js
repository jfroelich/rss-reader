import {update_feed} from '/src/db/update-feed.js';

// TODO: deprecate, inline everywhere (like 1 place?)
export async function deactivate_feed(session, feed_id, reason) {
  const props = {};
  props.id = feed_id;
  props.active = false;
  props.deactivateDate = new Date();
  props.deactivationReasonText = reason;
  const overwrite_flag = false;
  await update_feed(session, props, overwrite_flag);
}
