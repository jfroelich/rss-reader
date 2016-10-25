// See license.md

'use strict';

{

function refresh_feed_icons(log) {
  log.log('Refreshing feed favicons...');
  const ctx = {
    'pending_count': 0,
    'num_feeds_modified': 0,
    'log': log,
    'conn': null,
    'icon_cache': new FaviconCache(log),
    'icon_cache_conn': null
  };

  const connectPromise = db_connect(undefined, log);
  connectPromise.then(feed_db_connect_on_success.bind(ctx));
  connectPromise.catch(feed_db_connect_on_error.bind(ctx));
}

function feed_db_connect_on_success(conn) {
  this.log.debug('Connected to database', conn.name);
  this.conn = conn;
  this.icon_cache.connect(icon_cache_connect_on_success.bind(this),
    icon_cache_connect_on_error.bind(this));
}

function feed_db_connect_on_error(error) {
  on_complete.call(this);
}

function icon_cache_connect_on_success(event) {
  this.log.debug('Connected to database', this.icon_cache.name);
  this.icon_cache_conn = event.target.result;
  db_get_all_feeds(this.log, this.conn).then(
    get_feeds_on_success.bind(this)).catch(get_feeds_on_error.bind(this));
}

function icon_cache_connect_on_error(event) {
  this.log.debug(event.target.error);
  on_complete.call(this);
}

function get_feeds_on_error(error) {
  on_complete.call(this);
}

function get_feeds_on_success(feeds) {
  if(!feeds.length) {
    on_complete.call(this);
    return;
  }

  this.pending_count = feeds.length;
  for(let feed of feeds) {
    lookup.call(this, feed);
  }
}

function lookup(feed) {
  let lookup_url = null;
  if(feed.link) {
    lookup_url = new URL(feed.link);
  } else {
    const feed_url = new URL(get_feed_url(feed));
    lookup_url = new URL(feed_url.origin);
  }

  this.log.debug('Looking up favicon for feed %s using url %s',
    get_feed_url(feed), lookup_url.href);

  const doc = null;
  favicon_lookup(this.icon_cache, this.icon_cache_conn, lookup_url, doc,
    this.log, on_favicon_lookup_url.bind(this, feed));
}

function on_favicon_lookup_url(feed, icon_url) {
  this.log.debug('favicon_lookup result for feed', get_feed_url(feed),
    icon_url ? icon_url.href : 'no icon');

  if(icon_url) {
    if(!feed.faviconURLString || feed.faviconURLString !== icon_url.href) {
      this.log.debug('Setting feed %s favicon to %s', get_feed_url(feed),
        icon_url.href);
      this.num_feeds_modified++;
      feed.faviconURLString = icon_url.href;
      db_put_feed(this.log, this.conn, feed).then(
        put_feed_on_success).catch(
          put_feed_on_error);
    }
  }

  this.pending_count--;
  if(!this.pending_count)
    on_complete.call(this);
}

function put_feed_on_success(feed) {
  // noop
}

function put_feed_on_error(error) {
  // noop
}

function on_complete() {
  if(this.icon_cache_conn)
    this.icon_cache_conn.close();
  if(this.conn)
    this.conn.close();
  this.log.log('Refreshed favicons, modified',
    this.num_feeds_modified, 'feeds');
}

this.refresh_feed_icons = refresh_feed_icons;

}
