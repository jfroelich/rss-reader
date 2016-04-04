// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: remove async dependency
// TODO: remove reliance on db_for_each_feed, do explicit iteration here,
// or maybe make a function that generates the initial request at least, and
// then do the iteration (e.g. db_get_feeds_request)

// Requires: /lib/async.js
// Requires: /lib/parse-srcset.js
// Requires: /src/db.js
// Requires: /src/image.js
// Requires: /src/image-dimensions.js
// Requires: /src/net.js
// Requires: /src/resolve-urls.js
// Requires: /src/url.js

function poll_start() {
  'use strict';

  console.log('Starting poll ...');

  if(!poll_is_online()) {
    console.debug('Polling canceled because offline');
    return;
  }

  chrome.permissions.contains({permissions: ['idle']},
    poll_on_check_idle_permission);
}

function poll_is_online() {
  'use strict';

  if(!navigator) {
    return true;
  }

  if(!navigator.hasOwnProperty('onLine')) {
    return true;
  }

  return navigator.onLine;
}

function poll_on_check_idle_permission(permitted) {
  'use strict';
  const IDLE_PERIOD = 60 * 5; // 5 minutes

  // If we are permitted to check idle state, then check it. Otherwise,
  // immediately continue to polling.
  if(permitted) {
    chrome.idle.queryState(IDLE_PERIOD, poll_on_query_idle_state);
  } else {
    db_open(poll_iterate_feeds);
  }
}

function poll_on_query_idle_state(state) {
  'use strict';

  if(state === 'locked' || state === 'idle') {
    // If we appear to be idle then start polling
    db_open(poll_iterate_feeds);
  } else {
    // We are not idle, so end polling
    console.debug('Polling canceled because not idle');
    poll_on_complete();
  }
}

// Iterate over the feeds in the database, and update each feed.
function poll_iterate_feeds(event) {
  'use strict';

  // Exit early if there was a database connection error
  if(event.type !== 'success') {
    console.debug(event);
    poll_on_complete();
    return;
  }

  // TODO: rather than delegate iteration to the database, i would prefer to
  // control iteration here. However, we can still delegate the generation
  // of the cursor request to an external db function


  const connection = event.target.result;
  const boundFetchFeed = poll_fetch_feed.bind(null, connection);
  db_for_each_feed(connection, boundFetchFeed, false, poll_on_complete);
}

function poll_fetch_feed(connection, feed) {
  'use strict';

  const timeout = 10 * 1000;
  const onFetchFeedBound = poll_on_fetch_feed.bind(null, connection, feed);
  net_fetch_feed(feed.url, timeout, onFetchFeedBound);
}

function poll_on_fetch_feed(connection, feed, event, remoteFeed) {
  'use strict';

  // Exit early if an error occurred while fetching. This does not
  // continue processing the feed or its entries. The event is only defined
  // if there was a fetch error.
  // TODO: rather than check if event is defined or not, check if event
  // has the proper type (e.g. type === 'load') or whatever it is
  if(event) {
    //console.dir(event);
    console.debug('Error fetching', feed.url);
    return;
  }

  // TODO: if we are cleaning up the properties in db_store_feed,
  // are we properly cascading those cleaned properties to the entries?
  // is there any sanitization there that would need to be propagated?
  // maybe sanitization isn't a function of storage, and storage just
  // stores, and so this should be calling sanitize_before_store or
  // something to that effect that prepares a feed object for storage. in
  // fact that function creates a new storable object
  // TODO: also, it still is really unclear which feed is which, what is
  // feed and what is remoteFeed? How much of the original feed do I need?

  const onStoreFeedBound = poll_on_store_feed.bind(null, connection, feed,
    remoteFeed);
  db_store_feed(connection, feed, remoteFeed, onStoreFeedBound);
}

// TODO: what's with the _?
function poll_on_store_feed(connection, feed, remoteFeed, _) {
  'use strict';

  // TODO: stop using the async lib. Do custom async iteration here.

  async.forEach(remoteFeed.entries,
    poll_find_entry_by_link.bind(null, connection, feed),
    poll_on_entries_updated.bind(null, connection));
}

function poll_on_entries_updated(connection) {
  'use strict';

  // Update the number of unread entries now that the number possibly changed
  // Pass along the current connection so that badge_update_count does not
  // have to create a new one.
  badge_update_count(connection);
}

// For an entry in the feed, check whether an entry with the same link
// already exists.
function poll_find_entry_by_link(connection, feed, entry, callback) {
  'use strict';
  const onFindEntryBound = poll_on_find_entry.bind(null, connection, feed,
    entry, callback);
  db_find_entry_by_link(connection, entry.link, onFindEntryBound);
}

// If an existing entry was found, then exit early (callback with no args to
// async.forEach which means continue to the next entry). Otherwise, the entry
// doesn't exist. Get the full html of the entry. Update the properties of the
// entry. Then store the entry, and then callback to async.forEach.
function poll_on_find_entry(connection, feed, entry, callback, event) {
  'use strict';
  const localEntry = event.target.result;
  if(localEntry) {
    callback();
  } else {
    const timeout = 20 * 1000;
    poll_augment_entry_content(entry, timeout, onAugment);
  }

  function onAugment(event) {
    poll_cascade_feed_properties(feed, entry);
    db_store_entry(connection, entry, callback);
  }
}

// Copy some properties from feed into entry prior to storage
function poll_cascade_feed_properties(feed, entry) {
  'use strict';
  entry.feed = feed.id;

  // Denormalize now to avoid doing the lookup on render
  entry.feedLink = feed.link;
  entry.feedTitle = feed.title;

  // Use the feed's date for undated entries
  if(!entry.pubdate && feed.date) {
    entry.pubdate = feed.date;
  }
}

// The entire poll completed
function poll_on_complete() {
  'use strict';
  console.log('Polling completed');
  localStorage.LAST_POLL_DATE_MS = String(Date.now());
  notification_show('Updated articles');
}

// TODO: move this into a separate lib?
// Fetch the full content for the entry
function poll_augment_entry_content(entry, timeout, callback) {
  'use strict';
  const onFetchHTMLBound = poll_on_fetch_html.bind(null, entry, callback);
  net_fetch_html(entry.link, timeout, onFetchHTMLBound);
}

// If an error occurred when fetching the full html, exit early with a no-args
// callback to signal to async.forEach to continue to the next entry.
// Otherwise, clean up the html. Remove urls, set image sizes, resolve urls.
function poll_on_fetch_html(entry, callback, error, document, responseURL) {
  'use strict';
  if(error) {
    console.debug(error);
    callback();
    return;
  }

  if(responseURL !== entry.link) {
    console.debug('Response URL changed from %s to %s', entry.link,
      responseURL);
  }

  poll_filter_blacklisted_urls(document);

  image_transform_lazily_loaded(document);
  resolve_urls(document, responseURL);
  const onSetDimensions = poll_on_set_image_dimensions.bind(null, entry, document,
    callback);
  image_dimensions_set_all(document, onSetDimensions);
}

// Remove or modify elements with unwanted urls
function poll_filter_blacklisted_urls(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  for(let i = 0, len = images.length, image, src; i < len; i++) {
    image = images[i];

    src = image.getAttribute('src');

    if(src && /scorecardresearch\.com/i.test(src)) {
      // console.debug('Removing:', image.outerHTML);
      image.remove();
    }
  }
}

// Upon setting the sizes of images, replace the content property of the entry,
// and then callback to signal to async.forEach to continue.
function poll_on_set_image_dimensions(entry, document, callback) {
  'use strict';
  const content = document.documentElement.outerHTML;
  if(content) {
    entry.content = content;
  }
  callback();
}
