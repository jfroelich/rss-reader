import * as db from '/src/db.js';
import {localstorage_read_int} from '/src/lib/localstorage.js';
import {append_slide} from '/src/slideshow-page/append-slide.js';
import {count_unread_slides} from '/src/slideshow-page/count-unread-slides.js';
import {mark_slide_read} from '/src/slideshow-page/mark-slide-read.js';
import {remove_slide} from '/src/slideshow-page/remove-slide.js';
import * as slideshow_state from '/src/slideshow-page/slideshow-state.js';

export async function show_next_slide() {
  const current_slide = slideshow_state.get_current_slide();

  if (!current_slide) {
    // just logging for curiosity, this is not an error, this function does not
    // assume there is a current slide in slideshow state
    console.warn('No current slide being transitioned away from?');
    return;
  }



  // show_next_slide is a potential source of jank, as well as just being not
  // very well designed, so this function is heavily commented for now.

  // Count the number of currently unread slides. Notably this is before marking
  // the current slide as read which would affect this count.
  const slide_unread_count = count_unread_slides();

  // On transition to the next slide, we want to mark the current slide as read
  // and also possibly append more slides and also possibly remove some older
  // slides. In all cases we are going to open a database connection.
  const conn = await db.open_db();

  // First mark the current slide as read. There is no need to wait for this
  // to complete before continuing. We can freely call conn.close later without
  // causing a problem here because close will implicitly wait for any pending
  // transactions to complete.

  // NOTE: mark_slide_read implicitly uses a readwrite transaction, so the
  // writing aspect means that implicitly, concurrent read requests to the same
  // object store may block (wait until the write completes before reading).
  // That means that even if we do not await this call, we still may be
  // introducing an implicit delay in the settling of later database-related
  // functions such as when later reading entries. This is a roundabout way of
  // critizing mark_slide_read as a leaky abstraction.

  // NOTE: on a similar note as above, part of the problem is that we use
  // separate transactions. One thing to keep in mind is that because the mark
  // operation is a write, and there is blocking, it means that by the time we
  // query for unread, the marked entry will be excluded from that read. Even
  // though this is unawaited, the write transaction was still started
  // immediately. Pending or not, the entry is effectively marked by the time of
  // the later read transaction.

  // NOTE: the element will not acquire the read attribute until (1) the
  // database is updated (2) a message is posted (3) a message is received (4)
  // the element is found again and updated. That means that for the rest of
  // show_next_slide it is unclear if the slide element has been updated. Even
  // if we waited for this to complete it would still be unreliable.

  // NOTE: mark_slide_read has checks for whether the slide is already in the
  // read state. We do not need to be concerned with it here. We could do a
  // check here if we wanted though. I just do not have a clear picture of who
  // should be responsible, the caller or the callee.

  // NOTE: awaiting because I am getting a ton of errors and want to see if this
  // somewhat fixes it without introducing lag

  await mark_slide_read(conn, current_slide).catch(console.error);

  // Prematurely update the view, while the state change is still pending, to
  // avoid issues with latency and such. Note this can causes strange
  // interaction with counting loaded unread.
  // Note this must occur after the call to mark_slide_read as otherwise that
  // exits early if it finds this attribute
  // Note this causes other issues, but it kind of fixes the mark-read error
  // that is happening.
  // TODO: maybe a better fix would be to await mark_slide_read so that there
  // is more of a delay and the race fixes it
  // current_slide.setAttribute('read', '');


  // Our next step is to consider loading additional slides. If there are still
  // unread articles queued up, then just cleanup and exit.
  if (slide_unread_count > 1) {
    // TEMP: just for monitoring recent changes to this function
    console.debug(
        'Not loading additional slides (more than one unread slide still present)');

    // Cleanup
    conn.close();

    // Show the next slide
    next();
    return;
  }

  // Let's plan on appending more slides. First determine the maximum number of
  // slides we will load from the database.
  // TODO: this setting should be initialized on install, the value of 3 should
  // not be supplied, this should rely on the setting existing and leave limit
  // undefined otherwise. The 3 is there as a temporary safeguard because I
  // don't think this is being initialized at the moment.
  const limit = localstorage_read_int('initial_entry_load_limit') || 3;

  // Load more slides. We pass in the number of currently unread slides as the
  // offset, so that those slides are not reloaded. Note that this offset value
  // excludes the slide currently being marked as read, because although that
  // request has started at this point, it has not completed by this point.
  // TODO: Or has it? Because the write transaction is blocking

  const mode = 'viewable';
  const entries = await db.get_entries(conn, mode, slide_unread_count, limit);

  // Start closing the connection (this is the earliest it can start closing).
  conn.close();

  // Append the loaded entries (if any) as slides. This must be done before
  // actually navigating to the next slide because there may not have been a
  // next slide yet. The navigation to the next slide is what may have triggered
  // more slides to be loaded. If the badge shows an unread count, then
  // next-slide navigation should always work (even if slides not yet loaded in
  // view) because users should almost always be presented with a consistent
  // view of application state.
  if (entries.length) {
    append_entries_as_slides(entries);
  }

  // Show the next slide. Note this is done before checking if no entries
  // loaded, because that does not imply there is not a slide to navigate to.
  // The only true reason to cancel here would be if there is no slide loaded,
  // and there are no more slides at all (loaded prior to this invocation, or
  // during this invocation).
  next();

  // If no new entries were loaded DURING this invocation, there is no need to
  // do any more cleanup
  if (!entries.length) {
    return;
  }

  // The maximum number of slides loaded at any one time.
  // TODO: this should come from local storage
  const max_load_count = 6;

  // Now that we appended some more slides, unload some old slides.
  const container = document.getElementById('slideshow-container');
  let first_slide = container.firstElementChild;
  while (container.childElementCount > max_load_count &&
         first_slide !== current_slide) {
    remove_slide(first_slide);
    first_slide = container.firstElementChild;
  }
}

function append_entries_as_slides(entries) {
  // TEMP: monitoring recent changes to caller function
  console.debug('Appending %d more slides', entries.length);

  // TODO: the function is so named because I want to make explicit the
  // currently implicit coercion of entry data. database entry objects are not
  // slide objects. It is truly strange to pass the wrong object type to the
  // append-slide function. Given the name of append-slide, the initial
  // assumption would be that it accepts a slide element or slide object of some
  // kind. But it is hardcoded to accept database entry objects. This is weird.
  // I would like to think about designing this better. Maybe one way would be
  // to coerce database entry objects into slide objects. See also the todo
  // in append-slide.js. append-slide is not the best abstraction. What it
  // should probably be doing, is create_slide_from_entry, and then doing the
  // appending to slide elements/objects.

  for (const entry of entries) {
    append_slide(entry);
  }
}

function next() {
  if (slideshow_state.get_active_transition_count() > 0) {
    return;
  }

  const current = slideshow_state.get_current_slide();
  if (!current) {
    return;
  }

  const next_slide = current.nextElementSibling;
  if (!next_slide) {
    return;
  }

  slideshow_state.increment_active_transition_count();

  // Hide the old slide
  current.style.left = '-100%';

  // NOTE: in process of creating this lib I noticed the source of the strange
  // behavior with why count is only 1 despite two transitions, it was here
  // because I forgot to increment again. But it is working like I want so I am
  // hesitant to change it at the moment. Not a bug, but a feature. Ew.
  // active_transition_count++;

  // Show the next slide
  next_slide.style.left = '0';

  // Make the next slide the current slide
  slideshow_state.set_current_slide(next_slide);
}
