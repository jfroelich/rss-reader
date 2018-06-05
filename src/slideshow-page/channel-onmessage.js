import {open_feed_db} from '/src/db/open-feed-db.js';
import {is_valid_entry_id} from '/src/entry.js';
import {log, warn} from '/src/log.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';
import {load_and_append_slides} from '/src/slideshow-page/load-and-append-slides.js';
import {page_style_onchange} from '/src/slideshow-page/page-style-onchange.js';
import {remove_slide} from '/src/slideshow-page/remove-slide.js';
import {is_current_slide} from '/src/slideshow-page/slideshow-state.js';

async function channel_onmessage(event) {
  if (!event.isTrusted) {
    console.warn('%s: untrusted event:', channel_onmessage.name, event);
    return;
  }

  const message = event.data;
  if (!message) {
    console.warn(
        '%s: received channel message event without any data?',
        channel_onmessage.name, event);
    return;
  }

  log('%s: handling message type:', channel_onmessage.name, message.type);

  switch (message.type) {
    case 'display-settings-changed':
      page_style_onchange(message);
      break;
    case 'entry-write':
      await on_entry_written(message);
      break;
    case 'entry-deleted':
      await on_entry_expired(message);
      break;
    case 'entry-archived':
      await on_entry_expired(message);
      break;
    case 'feed-deleted':
      break;
    case 'entry-marked-read':
      await on_entry_marked_read(message);
      break;
    case 'feed-written':
      // NOTE: this also happens when feed activated/deactivated, the message
      // will have a property 'property' with the value 'active'
      // TODO: just realized, no way to tell whether active or inactive as a
      // result
      // log('%s: feed written %o', channel_onmessage.name, message);
      break;
    default:
      log('%s: unknown message type', channel_onmessage.name, message);
      break;
  }
}

function channel_onmessageerror(event) {
  log('%s: could not deserialize message from channel',
      channel_onmessageerror.name, event);
}

async function on_entry_written(message) {
  if (!message.create) {
    // TEMP: eventually delete once confirmed to work
    log('%s: ignoring message', on_entry_written.name, message);
    return;
  }

  const unread_count = count_unread_slides();

  // There are enough slides loaded, no need to load more
  // TODO: no magic numbers, this should be a configuration setting
  if (unread_count > 3) {
    return;
  }

  // TODO: the view shouldn't be directly interacting with the database

  const conn = await open_feed_db();
  await load_and_append_slides(conn);
  conn.close();
}

// TODO: because the click listener is done in slideshow-page instead of in the
// Slideshow helper module, Slideshow.remove does not remove the listener, so it
// has to be explicitly removed here. I would prefer something better. I
// initially started doing the click handler within Slideshow, but it turns out
// that there are several things that must happen in response to a click, and I
// did a poor job of separating out the functionality
async function on_entry_expired(message) {
  const entry_id = message.id;

  if (!is_valid_entry_id(entry_id)) {
    console.warn(
        '%s: received invalid entry id', on_entry_expired.name, entry_id);
  }

  const slide = find_slide_by_entry_id(entry_id);
  if (!slide) {
    console.debug('No slide found with entry id', entry_id);
    return;
  }

  if (is_current_slide(slide)) {
    slide.setAttribute('stale', 'true');
    return;
  }

  remove_slide(slide);
}


async function on_entry_marked_read(message) {
  const entry_id = message.id;

  if (!is_valid_entry_id(entry_id)) {
    console.warn(
        '%s: received invalid id', on_entry_marked_read.name, entry_id);
  }

  const slide = find_slide_by_entry_id(entry_id);

  // NOTE: this is not an error because the slide may have been unloaded, but
  // it is still worthy of logging (I think?)
  if (!slide) {
    console.debug(
        '%s: no slide found for entry id', on_entry_marked_read.name, entry_id);
    return;
  }

  // Update the view state
  slide.setAttribute('read', '');
}

function find_slide_by_entry_id(entry_id) {
  return document.querySelector('slide[entry="' + entry_id + '"]');
}

// Run on module load
const channel = new BroadcastChannel(localStorage.channel_name);
channel.onmessage = channel_onmessage;
channel.onmessageerror = channel_onmessageerror;
