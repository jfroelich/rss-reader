import {update_feed} from './update-feed.js';

// TODO: deprecate, just inline this
export function activate_feed(session, feed_id) {
  const props = {};
  props.id = feed_id;
  props.active = true;
  props.deactivateDate = undefined;
  props.deactivationReasonText = undefined;
  const overwrite_flag = false;
  return update_feed(session, props, overwrite_flag);
}
