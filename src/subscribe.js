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
  };

  if(feed_db_conn) {
    db_contains_feed_url(log, feed_db_conn, get_feed_url(feed)).then(
      contains_feed_on_success.bind(ctx)).catch(
        contains_feed_on_error.bind(ctx));
  } else {
    db_connect(undefined, log).then(
      feed_db_connect_on_success.bind(ctx)).catch(
        feed_db_connect_on_error.bind(ctx));
  }
}

function feed_db_connect_on_success(conn) {
  this.log.log('Connected to database', conn.name);
  this.feed_db_conn = conn;
  this.should_close = true;
  db_contains_feed_url(this.log, this.feed_db_conn,
    get_feed_url(this.feed)).then(
      contains_feed_on_success.bind(this)).catch(
        contains_feed_on_error.bind(this));
}

function feed_db_connect_on_error(error) {
  this.log.error(error);
  on_complete.call(this, {'type': 'ConnectionError'});
}

function contains_feed_on_error(error) {
  on_complete.call(this, {'type': error.message});
}

function contains_feed_on_success(found, event) {
  if(found) {
    console.debug('Already subscribed to', get_feed_url(this.feed));
    on_complete.call(this, {'type': 'ConstraintError'});
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    db_add_feed(this.log, this.feed_db_conn, this.feed).then(
      add_feed_on_success.bind(this)).catch(add_feed_on_error.bind(this));
    return;
  }

  const req_url = new URL(get_feed_url(this.feed));
  const exclude_entries = true;
  fetch_feed(req_url, exclude_entries, this.log).then(
    on_fetch_feed.bind(this)).catch(fetch_feed_on_error.bind(this));
}

function fetch_feed_on_error(error) {
  log.log(error);
  on_complete.call(this, error.message);
}

// TODO: before merging and looking up favicon and adding, check if the user
// is already subscribed to the redirected url, if a redirect occurred
function on_fetch_feed(event) {
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
  db_add_feed(this.log, this.feed_db_conn, this.feed).then(
    add_feed_on_success.bind(this)).catch(
    add_feed_on_error.bind(this));
}

function add_feed_on_success(event) {
  this.log.log('Successfully stored new feed');
  this.did_subscribe = true;
  on_complete.call(this, {'type': 'success', 'feed': event.feed});
}

function add_feed_on_error(error) {
  on_complete.call(this, {'type': error.message});
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
