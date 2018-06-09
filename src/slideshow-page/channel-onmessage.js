import {refresh_badge} from '/src/badge.js';
import {get_entries, is_valid_entry_id, open_reader_db} from '/src/reader-db.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';
import {page_style_onchange} from '/src/slideshow-page/page-style-onchange.js';
import {remove_slide} from '/src/slideshow-page/remove-slide.js';
import {is_current_slide} from '/src/slideshow-page/slideshow-state.js';

// React to an incoming message event to the channel
async function slideshow_channel_onmessage(event) {
  if (!event.isTrusted) {
    console.warn('Untrusted event:', event);
    return;
  }

  const message = event.data;
  if (!message) {
    console.warn('Event without data:', event);
    return;
  }

  const badge_types = ['entry-write', 'entry-deleted', 'entry-marked-read'];
  if (badge_types.includes(message.type)) {
    refresh_badge(window.location.pathname);
  }

  // NOTE: some of the handlers are async because they do async things. we
  // do not need to await them here for processing purposes because this is the
  // last step of the function. ordinarily then it would be incorrect to block
  // for no logical reason. but, we do await them so as to cause rejections
  // to become thrown exceptions which because they are uncaught show in the
  // log to assist in debugging by console monitoring. because I hate the
  // alternative of function chaining syntax with promise.catch. what is it, the
  // fluent api? HATE it. apis like step1().step2().step3() should be "taken out
  // back". I hope that fad dies. I have to avoid promise-swallowed exceptions
  // still because errors need to bubble all the way up and be exposed, so this
  // is the way it is going to be.

  // NOTE: I don't really know what style I like. For now I treat this handler
  // as a forwarder/delegator to other handlers. I don't love this switch
  // syntax. But I see many projects handle the stuff right here without
  // forwarding, and I am not sure if I should do that. Food for thought is
  // whether it is more correct to distribute functionality among some helpers,
  // or to have it all be here in a giant function. Performance is not really
  // the concern. This is purely a style choice. Which approach is more
  // readable? Which is less error-prone? Which is more maintainable?

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
      // result. The feed-property-update operation needs to send out more
      // information in its messages.

      // console.log('feed-written message', message);
      break;
    default:
      console.warn('Unknown message type', message);
      break;
  }
}

function channel_onmessageerror(event) {
  // More correct to use warn when non-fatal
  console.warn('Could not deserialize message from channel event:', event);
}

// React to an article being created or updated within the database. We want to
// synchronize the current view with the new database state.
async function on_entry_written(message) {
  // For now, we only care about newly added articles. We do not try to update
  // an existing article in view, so we just ignore other types of updates.
  if (!message.create) {
    return;
  }

  // One of the objectives of synchronizing the view is to load additional
  // articles that have since become available after the time the view was
  // already loaded. To do this, the current criteria uses the number of unread
  // articles in the view as an indicator. If there are many unread articles,
  // just stop and do nothing.
  const max_unread_before_suppress_load = 3;
  const unread_count = count_unread_slides();
  if (unread_count > max_unread_before_suppress_load) {
    return;
  }

  // Query for and append new slides. They might get appended and become
  // immediately visible, or they may be rendered offscreen, but still appended
  // to the dom, in expectation of later viewing. The append call takes care
  // of whether an article should initially appear as visible, so it is not our
  // concern.

  // This currently does some funkiness to avoid loading a new article when that
  // article isn't actually new in the sense it somehow already exists in the
  // view. Maybe because this function was somehow running concurrently with
  // itself. What this does it make the assumption that the number of unread
  // are the most recently added because that is the order in which articles
  // are loaded, and it just jumps past them to the next first unread not yet
  // loaded. So we specify the current unread count as the number of articles to
  // skip over in the query.

  // TODO: what we should be doing instead is specifying the number of remaining
  // articles in the view, read or unread, as the offset. That or just inventing
  // an approach that doesn't run headfirst into this crappy logic.

  // NOTE: note to self, this isn't the source of the jank, this is an async
  // thing. The jank is when navigating. But, solving that jank might mean
  // aggressively loading more here, not sure. These events come in sporadically
  // together with polling, so there isn't correlation to user actions when
  // not doing an explicit user-initiated manual poll.

  let offset = unread_count;
  let limit = undefined;
  const conn = await open_reader_db();
  const entries = await get_entries(conn, 'viewable', offset, limit);
  conn.close();
  for (const entry of entries) {
    append_slide(entry);
  }
}

// React to a message about an entry becoming expired. An entry is expired when
// it is archived or deleted.
async function on_entry_expired(message) {
  // All expire messages share a similar format with an entry id field
  const entry_id = message.id;

  // This should never happen. It is not that I care too much about throwing
  // an error here though. This error goes nowhere but the console. Really this
  // is just to make a message show up in the console to aid in debugging by
  // console, and to exit so as to prevent later errors.
  if (!is_valid_entry_id(entry_id)) {
    throw new Error('Invalid entry id ' + entry_id);
  }

  const slide = find_slide_by_entry_id(entry_id);
  if (!slide) {
    // no throw, no log. this is a spewed message that happens all the time
    // when unsubscribing and such. this is not an error. just exit.
    return;
  }

  // Now take action. If the slide is currently visible, we cannot remove it
  // from the view. So instead, mark it as stale so that other parts of the
  // view can proactively deal with this case.
  if (is_current_slide(slide)) {
    slide.setAttribute('stale', 'true');
    return;
  }

  remove_slide(slide);
}

// When an article gets marked as read, the database update operation does not
// do an immediate callback. Instead it sends out a message to any channel
// listeners. That event eventually makes its way back here. At this point we
// know the database state was changed successfully.
async function on_entry_marked_read(message) {
  const entry_id = message.id;

  // Exit early, and show something in the console. Should never happen.
  if (!is_valid_entry_id(entry_id)) {
    throw new Error('Invalid entry id' + entry_id);
  }

  const slide = find_slide_by_entry_id(entry_id);

  // This isn't an error. What happens is the view is in a diff state than the
  // database. Let's say the app is actively marking the article as read. Then
  // let's say the app also is actively expiring the article for some reason,
  // such as it being deleted. Those processes are concurrent and there is
  // no reliable order to how they resolve. In the case that the expire resolved
  // first, the slide may get unloaded from view before the mark-read resolves
  // and sends out a message and gets to here, and therefore not be found here.
  // Or, the slide just may have never been loaded into view in the first place
  // but was somehow marked as read by an external process, such as if I ever
  // implement some kind of mark-all-as-read feature in the future.
  if (!slide) {
    return;
  }

  // NOTE: even if the slide is stale, mark it is read. It does not impact
  // anything but it feels more correct. But we could check slide attribute
  // stale presence here if we wanted, and take a different course of action.

  // Update the view state
  slide.setAttribute('read', '');
}

function find_slide_by_entry_id(entry_id) {
  return document.querySelector('slide[entry="' + entry_id + '"]');
}

// Run on every module load. This channel persists for the lifetime of the page
// because it needs to listen for messages indefinitely so long as the page is
// loaded.
const channel = new BroadcastChannel(localStorage.channel_name);
channel.onmessage = slideshow_channel_onmessage;
channel.onmessageerror = channel_onmessageerror;
