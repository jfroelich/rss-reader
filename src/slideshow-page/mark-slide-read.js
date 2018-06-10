import {mark_entry_read} from '/src/db.js';

// Transitions a slide into the unread state. Asynchronously updates the
// database.
export function mark_slide_read(conn, slide) {
  // Ignore the slide if was already read, or is in the stale state for some
  // reason (e.g. deleted from database while being viewed).
  if (slide.hasAttribute('read') || slide.hasAttribute('stale')) {
    return;
  }

  const entry_id_string = slide.getAttribute('entry');
  const entry_id = parseInt(entry_id_string, 10);

  // Create a short-lived local channel. Cannot use the slideshow global channel
  // because instances of BroadcastChannels cannot hear their messages.
  const channel = new BroadcastChannel(localStorage.channel_name);
  const promise1 = mark_entry_read(conn, channel, entry_id);
  const promise2 = promise1.then(_ => channel.close());
  promise2.catch(console.error);
}
