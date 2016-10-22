// See license.md

'use strict';

{

function subscribe(feed_db_conn, icon_cache_conn, feed, suppress_notifs,
  log = SilentConsole, callback) {
  if(!get_feed_url(feed))
    throw new TypeError();
  log.log('Subscribing to', get_feed_url(feed));
  const ctx = {
    'feed': feed,
    'did_subscribe': false,
    'should_close': false,
    'log': log,
    'suppress_notifs': suppress_notifs,
    'callback': callback,
    'feed_db_conn': feed_db_conn,
    'icon_cache_conn': icon_cache_conn
    'feed_db': new FeedDb(log)
  };

  if(feed_db_conn) {
    log.debug('Checking if subscribed using provided connection');
    db_contains_feed_url(log, feed_db_conn, get_feed_url(feed),
      on_find_feed.bind(ctx));
  } else {
    ctx.feed_db.open(feed_db_connect_on_success.bind(ctx),
      feed_db_connect_on_error.bind(ctx));
  }
}

function feed_db_connect_on_success(event) {
  this.log.log('Connected to database', this.feed_db.name);
  this.feed_db_conn = event.target.result;
  this.should_close = true;
  this.log.debug('Checking if subscribed using on demand connection');
  db_contains_feed_url(this.log, this.feed_db_conn, get_feed_url(this.feed),
    on_find_feed.bind(this));
}

function feed_db_connect_on_error(event) {
  this.log.error(event.target.error);
  on_complete.call(this, {'type': 'ConnectionError'});
}

function on_find_feed(found, event) {
  if(found) {
    console.debug('Already subscribed to', get_feed_url(this.feed));
    on_complete.call(this, {'type': 'ConstraintError'});
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    db_add_feed(this.log, this.feed_db_conn, this.feed,
      on_add_feed.bind(this));
    return;
  }

  const req_url = new URL(get_feed_url(this.feed));
  const exclude_entries = true;
  fetch_feed(req_url, exclude_entries, this.log, on_fetch_feed.bind(this));
}

function on_fetch_feed(event) {
  if(event.type !== 'success') {
    this.log.log('Fetch error type', event.type);
    if(event.type === 'InvalidMimeType') {
      on_complete.call(this, {'type': 'FetchMimeTypeError'});
    } else {
      on_complete.call(this, {'type': 'FetchError'});
    }
    return;
  }

  // TODO: before merging and looking up favicon and adding, check if the user
  // is already subscribed to the redirected url, if a redirect occurred

  this.feed = merge_feeds(this.feed, event.feed);
  const icon_cache = new FaviconCache(this.log);

  let url = null;
  if(this.feed.link) {
    url = new URL(this.feed.link);
  } else {
    const feed_url = new URL(get_feed_url(this.feed));
    // We know the actual url is not a webpage, but its origin probably is
    url = new URL(feed_url.origin);
  }

  const doc = null;
  lookup_favicon(icon_cache, this.icon_cache_conn, url, doc, this.log,
    on_lookup_icon.bind(this));
}

function on_lookup_icon(icon_url) {
  if(icon_url)
    this.feed.faviconURLString = icon_url.href;
  db_add_feed(this.log, this.feed_db_conn, this.feed, on_add_feed.bind(this));
}

function on_add_feed(event) {
  if(event.type === 'success') {
    this.log.log('Successfully stored new feed');
    this.did_subscribe = true;
    on_complete.call(this, {'type': 'success', 'feed': event.feed});
  } else {
    on_complete.call(this, {'type': event.type});
  }
}

function on_complete(event) {
  if(this.should_close && this.feed_db_conn) {
    this.log.log('Requesting database %s to close', this.feed_db_conn.name);
    this.feed_db_conn.close();
  }

  if(!this.suppress_notifs && this.did_subscribe) {
    // Grab data from the sanitized feed instead of the input
    const feed = event.feed;
    const feed_name = feed.title || get_feed_url(feed);
    const message = 'Subscribed to ' + feed_name;
    show_notification('Subscription complete', message,
      feed.faviconURLString);
  }

  if(this.callback)
    this.callback(event);
}

this.subscribe = subscribe;

}
