// See license.md

'use strict';

class SubscriptionService {

  constructor() {
    this.log = {
      'log': function(){},
      'debug': function(){},
      'warn': function(){},
      'error': function(){}
    };

    this.suppressNotifications = false;
    this.feedDb = new FeedDb();
    this.iconConn = null;
    this.fetchTimeout = 2000;
  }

  async connect() {
    await this.feedDb.connect();
    this.iconConn = await Favicon.connect();
  }

  close() {
    this.feedDb.close();

    if(this.iconConn) {
      this.iconConn.close();
    } else {
      this.log.warn('close partly failed, this.iconConn is undefined');
    }
  }

  // Returns the feed that was added if successful, or undefined/null if problem,
  // or throws error
  // TODO: this needs some revision, i think it should be throwing errors?
  // TODO: if redirected on fetch, check for redirect url contained in db
  // TODO: just do something like class FeedController {} ?
  async subscribe(feed) {
    const url = Feed.getURL(feed);
    this.log.log('Subscribing to feed with url', url);
    if(await this.feedDb.containsFeedURL(url)) {
      this.log.warn('Subscription failed, already subscribed to feed with url',
        url);
      return;
    }

    if('onLine' in navigator && !navigator.onLine) {
      this.log.debug('Proceeding with offline subscription');
      return await this.feedDb.addFeed(feed);
    }

    let remoteFeed;

    // TODO: why catch and return? I think I should allow this error to bubble
    // here. Might just be a remnant of when I was getting comforable with
    // async fns
    // Is fetching is a fatal error or not, when online (???)
    try {
      ({remoteFeed = feed} = await fetch_feed(url, this.fetch_timeout,
        this.log));
    } catch(error) {
      this.log.warn(error);
      return;
    }

    const mergedFeed = Feed.merge(feed, remoteFeed);

    // TODO: this should be a function in feed.js
    // TODO: there is no longer a guarantee that feed.link is a valid url, this
    // needs a try/catch if a url parse error is non-fatal. That or I should
    // revise Favicon.lookup to accept a string as input
    let lookupURL;
    if(mergedFeed.link) {
      lookupURL = new URL(mergedFeed.link);
    } else {
      const feedURL = new URL(Feed.getURL(mergedFeed));
      lookupURL = new URL(feedURL.origin);
    }

    // Favicon lookup errors are not fatal with respect to subscribing so
    // just log a warning
    try {
      const icon_url = await Favicon.lookup(this.iconConn, lookupURL, this.log);
      mergedFeed.faviconURLString = icon_url;
    } catch(error) {
      this.log.warn(error);
    }

    // TODO: once I move the feed prep work out of add feed, then addFeed
    // just needs to return the new id. I can set the id here and then return
    // the feed. I may not even need to return the feed.

    const addedFeed = await this.feedDb.addFeed(mergedFeed);
    if(!this.suppressNotifications) {
      const feedName = addedFeed.title || Feed.getURL(addedFeed);
      const message = 'Subscribed to ' + feedName;
      DesktopNotification.show('Subscription complete', message,
        mergedFeed.faviconURLString);
    }
    return addedFeed;
  }

  async unsubscribe(feedId) {
    if(!Number.isInteger(feedId) || feedId < 1)
      throw new TypeError('Invalid feed id ' + feedId);
    this.log.log('Unsubscribing from feed', feedId);
    const tx = this.feedDb.conn.transaction(['feed', 'entry'], 'readwrite');
    const ids = await this.feedDb.getFeedEntryIds(tx, feedId);
    this.log.debug('Preparing to remove %d entries', ids.length);
    const chan = new BroadcastChannel('db');
    const proms = ids.map((entryId) =>
      this.feedDb.removeEntry(tx, entryId, chan));
    proms.push(this.feedDb.removeFeed(tx, feedId));
    await Promise.all(proms);
    chan.close();
    this.log.debug('Unsubscribed from feed id', feedId);
    this.log.debug('Deleted %d entries', ids.length);
    return ids.length;
  }
}
