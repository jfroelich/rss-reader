import {assert} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as favicon from '/src/lib/favicon.js';
import * as feed_parser from '/src/lib/feed-parser.js';
import {better_fetch, is_redirect} from '/src/lib/net.js';
import {Entry} from '/src/model/entry.js';
import {Feed} from '/src/model/feed.js';
import {Model} from '/src/model/model.js';
import * as op_utils from '/src/ops/op-utils.js';

// This is a first draft. See #755. The big ideas are:
// * poll-feeds and subscribe share common functionality with only minor
// divergence
// * fetch-feed is awkward to use because subscribe cannot check whether
// response.url exists in the model before incurring unwanted overhead
// * fetch-feed is currently just plain awkward, because it is difficult to
// locate properly. It has to occur above the model layer, but below the ops
// layer, but it is not an op itself, but there is no great layer to represent
// this. It is highly coupled to the model, and therefore the app, so it does
// not belong as a generic lib.

// Basic plan is to implement the first draft. Migrate subscribe to use this.
// Migrate poll-feeds to use this. Deprecate fetch-feed entirely.

// Ok, first problem. subscribe accepts a url parameter but poll-feed accepts
// a feed parameter. The solution will be that subscribe will need to build a
// feed object internally before calling here, and this accepts a feed parameter
// NOTE: this will accept a model Feed object. poll-feeds needs to take into
// account that when it loads feeds from the model, those are feed-data objects,
// not Feed objects, so it will also need to do a conversion.

// Second problem. This works with two feed types. The model type, and the type
// produced by parsing. The solution is to rename each type on import. wait,
// nevermind, we never actually import the parsed feed type explicitly, so there
// is no naming conflict.

// TODO: eventually refactor iconn to be icon-service, this currently impl
// highlights the awkwardness, i would rather not directly expose IDBDatabase
// at this higher layer.

// TODO: after integration, this may be the only call site for net.is_redirect,
// so maybe it should just be moved here, and/or deprecated

// TODO: instead of a create flag, consider a flag like 'unique'. If unique
// is true, then uniqueness checks are done.

// TODO: instead of a create flag, branch based on whether feed.id is set? in
// some sense create is a functional dependency of feed.id. on the other hand,
// create expresses intent clearly where as feed.id presence/absence does not.

export async function refresh_feed(
    feed, model, iconn, rewrite_rules, inaccessible_descriptors, create = false,
    fetch_feed_timeout = INDEFINITE, fetch_html_timeout = INDEFINITE,
    feed_stored_callback = noop) {
  // TEMP: in the poll-feeds case, the previous implementation accepted a data
  // object loaded from the model. In the new implementation the caller will
  // need to use a model Feed object.
  assert(feed instanceof Feed);
  assert(model instanceof Model);
  assert(iconn === undefined || iconn instanceof IDBDatabase);
  assert(fetch_feed_timeout instanceof Deadline);
  assert(typeof feed_stored_callback === 'function');


  if (create) {
    // Check if already subscribed to the feed. For now, use only the tail url
    // to determine and assume the feed only has one url.
    const url = new URL(feed.getURLString());
    const existing_feed = await model.getFeed('url', url, /* key_only */ true);
    if (existing_feed) {
      const message = 'Already subscribed to feed with url ' + url.href;
      throw new ConstraintError(message);
    }
  } else {
    // We are updating a feed with new data and storing the update. Do an
    // upfront validation of the input rather than just rely on it failing
    // later after more work is done.
    assert(Feed.isValidId(feed.id));
  }

  // TEMP: poll-feeds at this point checks if the feed has a url and is active,
  // and if missing or url or inactive exits without error. Now, we throw an
  // error if the url is missing, and we no longer do the active check and let
  // the caller worry about that. In the subscribe case it just does not make
  // sense to impose the is-active constraint, and the subscribe case also
  // threw an error just like now.

  // TEMP: Next, we are going to fetch. Unlike either of the two earlier
  // implementaions, here we are bypassing fetch-feed and basically inlining all
  // of its functionality, so that in the subscribe case we can check whether
  // the redirect exists before doing a ton more work.

  // TEMP: the poll-feeds use case does checks against timeout and such in case
  // of an error, and logs an error and exits. the subscribe case just rethrows
  // all errors. i see two solutions. first, we just throw. the poll-feeds case
  // will need to be modified so that it can appropriately react to errors
  // polling a particular feed. alternatively, second, we branch on create here,
  // and in the subscribe case just throw, and in the poll-feeds case we do the
  // recording of the error and just exit. ok, the plan i think is to simply
  // throw any error here. the subscribe case works just like before. in the
  // poll-feeds case, i will have a wrapper function around the call to
  // poll-feed, and that is the function that will be Promise.all-ed, and in
  // that function, i call it with a try/catch and do the error handling there.

  const fetch_url = new URL(feed.getURLString());
  const fetch_options = {timeout: fetch_feed_timeout};
  const response = await better_fetch(fetch_url, fetch_options);
  const response_url = new URL(response.url);

  // Handle the redirect here. When subscribing, we want to check if the
  // redirect exists and throw an error if so. We also want to record the
  // redirect and update the feed's terminal url. When polling, we only care
  // about possibly updating the feed's terminal url.

  // TODO: i added a note to the net lib. is-redirect's 2nd parameter should
  // really be of type url, not response. i have completely forgotten why it
  // ended up that way. this should be able to pass along a url instead of the
  // response. however I am delaying that change because it is outside the
  // scope of the current refactor.

  // TODO: see earlier todo regarding unique flag. only perform this check if
  // unique is true?

  if (create && is_redirect(fetch_url, response)) {
    const existing_feed = await model.getFeed('url', response_url, true);
    if (existing_feed) {
      const message =
          'Already subscribed to redirected feed url ' + response_url.href;
      throw new ConstraintError(message);
    }
  }

  // Now that we have the response url, in all use cases we want to append
  // it to the feed.

  // TODO: perhaps the is_redirect is overkill, all that does is rule out hash.
  // I cannot recall exactly why I cared so much about that. Instead, we can
  // determine redirection simply by whether this append call actually results
  // in appending a new url. So we could just do
  // const appended_aka_redirected = feed.appendURL(response_url);
  // and then simply check the boolean later. However, I am defering this
  // change until after the current refactor as it is outside its scope.

  feed.appendURL(response_url);


  // In the subscribe case, the next step is to set the feed's favicon. But note
  // that at this point, subscribe was relying on all the work done by
  // fetch-feed. In the poll-feeds case, the next step is to merge the fetched
  // feed data with the current model/Feed object. poll-feeds also relied at
  // this point on fetch-feed doing a ton of work. Now that we plan to deprecate
  // fetch-feed, we are basically doing to inline it here. fetch-feed did a ton
  // of coercion so that it could return a model feed object and then merge that
  // new object with the old one. we do not need to
  // do that here. instead, now what we do is take our existing in memory
  // model/Feed object and update it appropriately using the new fetched/parsed
  // data.

  // So first we need to get the fetched and parsed feed, like what was done in
  // fetch-feed. Get the full body of the response, and then parse it into a
  // parsed feed object.
  // TEMP: it looks like in poll-feeds case a parse error here is caught by
  // the catch of the trapped call to fetch-feed. That is no longer the case, so
  // note again that poll-feeds wrapper call to this function will also need to
  // handle errors from either response.text() or the parse call.
  const response_text = await response.text();
  const parsed_feed = feed_parser.parse_from_string(response_text);

  delete feed.errorCount;

  update_model_feed_from_parsed_feed(feed, parsed_feed);

  // If creating, set the favicon. If updating, skip it because we leave that
  // to refresh-feed-icons that amortizes this cost.
  // TODO: if I want to drop the create flag, I need to rethink this. I could
  // do this by having a separate flag, set_feed_favicon, which poll-feeds set
  // to false and subscribe sets to true.
  if (create && iconn) {
    const lookup_url = op_utils.get_feed_favicon_lookup_url(feed);
    const request = new favicon.LookupRequest();
    request.url = lookup_url;
    const icon_url = await favicon.lookup(request);
    if (icon_url) {
      feed.faviconURLString = icon_url.href;
    }
  }

  Feed.sanitize(feed);
  Feed.validate(feed);

  if (create) {
    feed.id = await model.createFeed(feed);
  } else {
    await model.updateFeed(feed, /* overwrite */ true);
  }

  // TEMP: at this point, poll-feeds continues to process entries, and then
  // later does a notification after polling entries that includes a message
  // about the number of added entries. subscribe just does a notification about
  // subscribing to the feed. but also note, that there is some funkiness
  // in the options-page use case that calls subscribe, it does this strange
  // followup call directly into the old poll-feeds poll-feed implementation.
  // the reason being is that subscribe wants to know when the subscribe is
  // finished quickly, without waiting for all the entry processing to occur.
  // i think a better design is to have an optional callback that is invoked
  // here if set. the final entry point is still after the entry processing.
  // note that feed_stored_callback is optional parameter, it defaults to a
  // noop function, and there is an assert earlier that it is a defined function

  // TEMP: So I have an earlier todo about the issue with using a notify flag.
  // See Issue #716. I think I am going to follow through on the ideas espoused
  // in that issue. So, this implementation of poll-feed will not show desktop
  // notifications. the caller is responsible if they want to do it.

  // TODO: alternatively, we could dispatch an event here? So no direct callback
  // at all, and complete decoupling of listeners. Then the options-page or
  // whatever needs to handle the event instead of the callback.
  feed_stored_callback(feed);

  // Process the entries for the feed
  const model_entries = parsed_feed.entries.map(parsed_entry_to_model_entry);
  const new_entry_count = await process_entries(
      feed, model_entries, model, iconn, rewrite_rules,
      inaccessible_descriptors, fetch_html_timeout);

  // subscribe returns the feed that was added. poll-entries cared about the
  // number of new entries. for now the easiest solution is to just return
  // both, nothing better is coming to mind.
  const output = {};
  output.feed = feed;
  output.new_entry_count = new_entry_count;
  return output;
}

// Resolves when all entries processed. Returns the number of entries added.
async function process_entries(
    feed, entries, model, iconn, rewrite_rules, inaccessible_descriptors,
    fetch_html_timeout) {
  // Propagate feed information down to entries
  for (const entry of entries) {
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
    entry.faviconURLString = feed.faviconURLString;
    entry.datePublished = entry.datePublished || feed.datePublished;
  }

  const promises = [];
  for (const entry of entries) {
    const promise = process_entry_noexcept(
        entry, feed, model, iconn, rewrite_rules, inaccessible_descriptors,
        fetch_html_timeout);
    promises.push(promise);
  }

  const results = await Promise.all(promises);

  let sum = 0;
  for (const added of results) {
    if (added) {
      sum++;
    }
  }
  return sum;
}

async function process_entry_noexcept(
    entry, feed, model, iconn, rewrite_rules, inaccessible_descriptors,
    fetch_html_timeout) {
  try {
    return await process_entry(
        entry, feed, model, iconn, rewrite_rules, inaccessible_descriptors,
        fetch_html_timeout);
  } catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    } else {
      console.debug(error);
    }
  }
}


// Copy over properties from the parsed feed and appropriately update the local
// feed object with new data. Note that response url has already been appended,
// and that the local feed may already have one or more urls. Note that this
// updates by reference so it produces side effects on the input.
function update_model_feed_from_parsed_feed(feed, parsed_feed) {
  feed.type = parsed_feed.type;
  feed.title = parsed_feed.title;
  feed.description = parsed_feed.description;
  feed.datePublished = parsed_feed.date_published;

  // Try to normalize the new link value and overwrite. The link value comes
  // from the raw data and we are not sure if it is valid or if it is in the
  // normalized form that is used for comparison to other urls.
  if (parsed_feed.link) {
    try {
      const link_url = new URL(parsed_feed.link);
      feed.link = link_url.href;
    } catch (error) {
      // Ignore
    }
  }
}

// Convert parsed entries into model entries
function parsed_entry_to_model_entry(parsed_entry) {
  const entry = new Entry();
  entry.title = parsed_entry.title;
  entry.author = parsed_entry.author;
  entry.datePublished = parsed_entry.date_published;
  entry.content = parsed_entry.content;
  entry.enclosure = parsed_entry.enclosure;

  if (parsed_entry.link) {
    try {
      const link_url = new URL(parsed_entry.link);
      entry.appendURL(link_url);
    } catch (error) {
      // Ignore
    }
  }
  return entry;
}

function noop() {}

export class ConstraintError extends Error {
  constructor(message) {
    super(message);
  }
}
