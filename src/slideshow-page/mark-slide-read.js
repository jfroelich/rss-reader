import {mark_entry_read} from '/src/db.js';

// Transitions a slide into the unread state. Asynchronously updates the
// database.
export function mark_slide_read(conn, slide) {
  // Ignore the slide if was already read, or is in the stale state for some
  // reason (e.g. deleted from database while being viewed). In other words,
  // transform ourselves into a no-operation. Note there is the unresolved
  // question of whether this should be a caller or callee concern.

  if (slide.hasAttribute('read') || slide.hasAttribute('stale')) {
    // NOTE: returning undefined (by just returning) would be incorrect here.
    // This was previously a bug. This function should always return a promise.
    // This is similar to returning an optional. The bug was the caller was
    // trying to await on undefined when viewing an already-read slide. This
    // was a consequence of removing the async qualifier to the function without
    // fully considering the exit paths. Ironically, I increased complexity in
    // the implementation (the function body) by trying to reduce complexity in
    // the API (the function signature).
    return Promise.resolve();
  }

  const entry_id_string = slide.getAttribute('entry');
  const entry_id = parseInt(entry_id_string, 10);

  // Create a short-lived local channel. Cannot use the slideshow global channel
  // because instances of BroadcastChannels cannot hear their messages.
  const channel = new BroadcastChannel(localStorage.channel_name);
  const promise = mark_entry_read(conn, channel, entry_id);

  // NOTE: to be frank, the fluent api is so opaque and confusing I do not know
  // what is returned by then or catch. Are the return values promises, are they
  // non-promise values? If promises, are they the same input promise or a new
  // promise? Or is it a matter of timing and whether I am doing something
  // synchronously? Or is it up to me based on what I return from the function
  // parameter to them? What a horrible API. I am almost tempted to revert to
  // using an await qualifier. But that just disguises my confusion here. I am
  // leaving this comment here as a reminder to review this junk. Need to learn
  // it before critizing it in order to have valid criticism. Sadly what
  // happened here is I learned this years ago, but it is so hard to remember.

  promise.then(_ => channel.close());
  promise.catch(console.error);
  return promise;
}
