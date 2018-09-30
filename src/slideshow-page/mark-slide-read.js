import * as db from '/src/db/db.js';

// Starts transitioning a slide into the read state. Updates both the view and
// the database. This resolves before the view is fully updated. This only sets
// the slide's read-pending attribute, not its read attribute.
export async function mark_slide_read_start(session, slide) {
  const entry_id_string = slide.getAttribute('entry');
  const entry_id = parseInt(entry_id_string, 10);

  // Exit if prior call still in flight. Callers may naively make concurrent
  // calls to mark_slide_read_start. This is routine, expected, and not an
  // error.
  if (slide.hasAttribute('read-pending')) {
    console.debug('Slide is already read-pending', entry_id);  // TEMP
    return;
  }

  // The slide was already read. Typically happens when navigating away from a
  // slide a second time. Not an error.
  if (slide.hasAttribute('read')) {
    console.debug('Slide is already read', entry_id);  // TEMP
    return;
  }

  // A slide is stale for various reasons such as its corresponding entry being
  // deleted from the database. Callers are not expected to avoid calling this
  // on stale slides. Not an error.
  if (slide.hasAttribute('stale')) {
    return;
  }

  // Signal to future calls that this is now in progress
  slide.setAttribute('read-pending', '');

  await db.mark_entry_read(session, entry_id);
}

// This should be called once the view acknowledges it has received the message
// sent to the channel by mark_slide_read_start to fully resolve the mark read
// operation.
export function mark_slide_read_end(slide) {
  // Do not exit early if the slide is stale. Even though updating the state of
  // a stale slide seems meaningless, other algorithms such as counting unread
  // slides may be naive and only consider the read attribute
  slide.setAttribute('read', '');
  slide.removeAttribute('read-pending');
}
