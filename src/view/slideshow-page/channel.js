import * as badge from '/src/control/badge.js';
import * as db from '/src/db/db.js';
import {append_slide} from './append-slide.js';
import {count_unread_slides} from './count-unread-slides.js';
import {mark_slide_read_end} from './mark-slide-read.js';
import {remove_slide} from './remove-slide.js';
import {is_current_slide} from './slideshow-state.js';

let channel;

export function init() {
  if (channel) {
    throw new Error('channel already initialized');
  }

  channel = new BroadcastChannel('reader');
  channel.onmessage = onmessage;
  channel.onmessageerror = onmessageerror;
}

// React to an incoming message event to the channel
async function onmessage(event) {
  if (!event.isTrusted) {
    return;
  }

  const message = event.data;
  if (!message) {
    return;
  }

  // Common behavior for type handlers related to updating the badge
  const badge_types =
      ['entry-created', 'entry-updated', 'entry-deleted', 'entry-read'];
  if (badge_types.includes(message.type)) {
    const locker_name = location.pathname;
    badge.refresh(locker_name);  // non-blocking
  }

  // Type handlers are ordered by estimated frequency. Using if-blocks because I
  // found the switch syntax hard to read.
  const type = message.type;

  if (type === 'entry-read') {
    const slide = find_slide_by_entry_id(message.id);
    if (slide) {
      mark_slide_read_end(slide);
    }
    return;
  }

  // TODO: this double test against type is awkward, need to revisit, but
  // currently only focused on deprecating entry-write message type
  if (type === 'entry-created' || type === 'entry-updated') {
    // For now, we only care about newly added articles, because we do support
    // hot-swapping content
    if (type !== 'entry-created') {
      return;
    }

    // One of the objectives of synchronizing the view is to load additional
    // articles that have since become available after the time the view was
    // already loaded. To do this, the current criteria uses the number of
    // unread articles in the view as an indicator.
    // TODO: should this come from config?
    const max_unread_before_suppress_load = 3;
    const unread_count = count_unread_slides();

    // If there are already enough unread articles, do nothing.
    if (unread_count > max_unread_before_suppress_load) {
      return;
    }

    // Query for and append new slides. They might get appended and become
    // immediately visible, or they may be rendered offscreen, but still
    // appended to the dom, in expectation of later viewing. The append call
    // takes care of whether an article should initially appear as visible, so
    // it is not our concern.

    // This currently does some funkiness to avoid loading a new article when
    // that article isn't actually new in the sense it somehow already exists in
    // the view. Maybe because this function was somehow running concurrently
    // with itself. What this does it make the assumption that the number of
    // unread are the most recently added because that is the order in which
    // articles are loaded, and it just jumps past them to the next first unread
    // not yet loaded. So we specify the current unread count as the number of
    // articles to skip over in the query.

    // TODO: what this should be doing instead is specifying the number of
    // remaining articles in the view, read or unread, as the offset. That or
    // just inventing an approach that doesn't run headfirst into this crappy
    // logic.

    let limit = undefined;
    const session = await db.open();
    const entries =
        await db.get_entries(session, 'viewable', unread_count, limit);
    session.close();

    for (const entry of entries) {
      append_slide(entry);
    }
    return;
  }

  if (type === 'entry-deleted' || type === 'entry-archived') {
    const slide = find_slide_by_entry_id(message.id);
    // The slide may not exist (this is routine and not an error)
    if (slide) {
      if (is_current_slide(slide)) {
        // TODO: set to empty string instead (or will using one param work?)
        slide.setAttribute('stale', 'true');
      } else {
        remove_slide(slide);
      }
    }
    return;
  }

  if (type === 'feed-deleted') {
    // TODO: implement
    return;
  }

  if (type === 'feed-activated') {
    // TODO: implement
    return;
  }

  if (type === 'feed-deactivated') {
    // TODO: implement
    return;
  }

  if (type === 'feed-created') {
    // TODO: implement
    return;
  }

  if (type === 'feed-updated') {
    // TODO: implement
    return;
  }

  // All types should be explicitly handled, even if they do nothing but exit.
  // This message appearing serves as a continual incentive.
  console.warn('Unhandled message', JSON.stringify(message));
}

function onmessageerror(event) {
  console.warn(event);
}

function find_slide_by_entry_id(entry_id) {
  return document.querySelector('slide[entry="' + entry_id + '"]');
}
