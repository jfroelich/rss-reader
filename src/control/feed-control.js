import * as app from '/src/app/app.js';
import {assert} from '/src/assert/assert.js';
import * as db from '/src/db/db.js';
import * as favicon from '/src/favicon/favicon.js';
import * as array from '/src/lang/array.js';
import {filter_empty_properties} from '/src/lang/filter-empty-properties.js';
import * as Feed from '/src/model/feed.js';
import {fetch_feed} from '/src/net/fetch-feed.js';
import {url_did_change} from '/src/net/url-did-change.js';

// Subscribe to a feed. This creates a new feed in the database
// @param rconn {IDBDatabase} an open feed database connection
// @param iconn {IDBDatabase} an open icon database connection
// @param channel {BroadcastChannel} where to send messages
// @param url {URL} the url to subscribe
// @param notify {Boolean} whether to send a notification
// @param fetch_timeout {Number} fetch timeout
// @param skip_icon_lookup {Boolean}
// @error database errors, type errors, fetch errors, etc
// @return {Promise} resolves to the feed object stored in the database
export async function subscribe(
    rconn, iconn, channel, url, fetch_timeout, should_notify = true,
    skip_icon_lookup) {
  const query_mode = 'url';
  const load_key_only = true;
  let existing_feed = await db.get_feed(rconn, query_mode, url, load_key_only);
  if (existing_feed) {
    throw new Error('Already subscribed ' + url.href);
  }

  // Fetch and parse and coerce the remote feed without entries. Rethrow any
  // errors
  const response = await fetch_feed(url, fetch_timeout, true, false);
  const feed = response.feed;
  const res_url = new URL(array.peek(feed.urls));

  if (url_did_change(url, res_url)) {
    existing_feed =
        await db.get_feed(rconn, query_mode, res_url, load_key_only);
    if (existing_feed) {
      throw new Error('Already subscribed ' + res_url.href);
    }
  }

  if (!Feed.is_valid(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  if (!skip_icon_lookup) {
    const url = favicon.create_lookup_url(feed);
    let doc = undefined;
    const fetch = false;
    feed.faviconURLString = await favicon.lookup(iconn, url, doc, fetch);
  }

  db.sanitize_feed(feed);
  await update_feed(rconn, channel, feed);

  if (should_notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || array.peek(feed.urls);
    const message = 'Subscribed to ' + feed_title;
    app.show_notification(title, message, feed.faviconURLString);
  }

  return feed;
}


// Find a feed in the database by id or by url
export function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || (value && typeof value.href === 'string'));
    assert(mode !== 'id' || Feed.is_valid_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.transaction('feed');
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('feed');

    let request;
    if (mode === 'url') {
      const index = store.index('urls');
      const href = value.href;
      request = key_only ? index.getKey(href) : index.get(href);
    } else if (mode === 'id') {
      request = store.get(value);
    } else {
      throw new TypeError('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      let feed;
      if (key_only) {
        const feed_id = request.result;
        if (Feed.is_valid_id(feed_id)) {
          feed = Feed.create();
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
    };
  });
}

export function get_feed_ids(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = _ => resolve(request.result);
  });
}

export function get_feeds(conn, mode = 'all', sort = false) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.getAll();
    request.onerror = _ => reject(request.error);
    request.onsuccess = _ => {
      const feeds = request.result;
      if (sort) {
        feeds.sort(compare_feeds);
      }

      if (mode === 'active') {
        resolve(feeds.filter(feed => feed.active));
      } else {
        resolve(feeds);
      }
    };
  });
}

function compare_feeds(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}

export function update_feed_properties(
    conn, channel, feed_id, name, value, extra_props = {}) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));
    assert(typeof name === 'string' && name);
    assert(name !== 'id');  // refuse setting this particular prop

    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'feed-written', id: feed_id, property: name});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = _ => {
      const feed = request.result;
      assert(feed);                // indicates bad id or unexpected state
      assert(Feed.is_feed(feed));  // corrupted state

      const run_date = new Date();

      if (name === 'active') {
        // TODO: use asserts here
        if (feed.active && value) {
          console.error(
              'Tried to activate active feed (invalid state) %d', feed_id);
          return;
        } else if (!feed.active && !value) {
          console.error(
              'Tried to deactivate inactive feed (invalid state) %d', feed_id);
          return;
        }

        // Set functional dependencies
        if (value === true) {
          delete feed.deactivationReasonText;
          delete feed.deactivateDate;
        } else if (value === false) {
          if (typeof extra_props.reason === 'string') {
            feed.deactivationReasonText = extra_props.reason;
          } else {
            delete feed.deactivationReasonText;
          }
          feed.deactivateDate = run_date;
        } else {
          // If undefining, cleanup
          // TODO: is this case of undefined even allowed? might not make sense
          // TODO: if these fields do not even exist, should I try to no-op?
          delete feed.deactivationReasonText;
          delete feed.deactivateDate;
        }
      }

      if (typeof value === 'undefined') {
        // Remove the property rather than set to undefined. Normally frowned
        // upon because we want to maintain v8 object shape, but in this case it
        // actually reduces disk space.
        delete feed[name];
      } else {
        feed[name] = value;
      }

      if (name !== 'dateUpdated') {
        feed.dateUpdated = run_date;
      }

      request.source.put(feed);
    };
  });
}

// Creates or updates a feed in the database
export function update_feed(conn, channel, feed) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_feed(feed));
    assert(feed.urls && feed.urls.length);

    filter_empty_properties(feed);

    const is_create = !feed.id;
    if (is_create) {
      feed.active = true;
      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    } else {
      feed.dateUpdated = new Date();
    }

    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      const message = {type: 'feed-written', id: feed.id, create: is_create};
      channel.postMessage(message);
      resolve(feed.id);
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.put(feed);

    // result is id in both cases, but only care about create
    if (is_create) {
      request.onsuccess = _ => feed.id = request.result;
    }
  });
}

// Remove a feed and its entries, send a message to channel for each removal.
// If feed id does not exist then no error is thrown this is just a noop. reason
// is an optional, intended as categorical string.
export function delete_feed(conn, channel, feed_id, reason) {
  return new Promise((resolve, reject) => {
    // If not checked this would be a noop which is misleading
    if (!Feed.is_valid_id(feed_id)) {
      throw new TypeError('Invalid feed id ' + feed_id);
    }

    const entry_ids = [];
    const txn = conn.transaction(['feed', 'entry'], 'readwrite');
    txn.oncomplete = _ => {
      let msg = {type: 'feed-deleted', id: feed_id, reason: reason};
      channel.postMessage(msg);
      msg = {type: 'entry-deleted', id: 0, reason: reason, feed_id: feed_id};
      for (const id of entry_ids) {
        msg.id = id;
        channel.postMessage(msg);
      }
      resolve();
    };

    txn.onerror = _ => reject(txn.error);

    const feed_store = txn.objectStore('feed');
    feed_store.delete(feed_id);

    const entry_store = txn.objectStore('entry');
    const feed_index = entry_store.index('feed');
    const request = feed_index.getAllKeys(feed_id);
    request.onsuccess = _ => {
      const keys = request.result;
      for (const id of keys) {
        entry_ids.push(id);
        entry_store.delete(id);
      }
    };
  });
}
