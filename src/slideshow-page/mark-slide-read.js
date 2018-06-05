import {db_mark_entry_read} from '/src/db/db-mark-entry-read.js';
import {log} from '/src/log.js';

// BUG: some kind of bug, possibly due to the non-blocking call. The bug is
// logic, there is no js error. Entries are getting marked as read, but
// re-appear occasionally when navigation, and sometimes next-slide key press
// does not advance slide. Note this is an old bug and may have been fixed but
// I did not properly track things and have not since reviewed.

// TODO: if this creates its own conn instead of trying to reuse, then could it
// run unawaited? Or was it the channel that was causing the issue and now
// irrelevant because this now uses local channel instance?
// TODO: this should not need to be async and await. However, right now when it
// does not wait the call to update badge unread count fails because the
// subsequent conn.close call occurs too early
// TODO: rather than await call to `db_mark_entry_read`, this should listen for
// entry-marked-read events roundtrip and handle the event when it later occurs
// to mark the corresponding slide. Then this can be called non-awaited
// TODO: maybe display an error if `db_mark_entry_read` fails?
// TODO: using console.assert is dumb, should just exit early, or not assert
// at all

export async function mark_slide_read(conn, slide) {
  console.assert(conn instanceof IDBDatabase);
  console.assert(slide);

  if (slide.hasAttribute('read') || slide.hasAttribute('stale')) {
    const entry_id_string = slide.getAttribute('entry');
    log('%s: ignoring stale/read slide', mark_slide_read.name, entry_id_string);
    return;
  }

  // This uses a short-lived local channel instance instead of the page-lifetime
  // channel because there is a no-loopback issue with channels in Chrome.

  const id = parseInt(slide.getAttribute('entry'), 10);
  const channel = new BroadcastChannel(localStorage.channel_name);
  await db_mark_entry_read(conn, channel, id);
  channel.close();
}
