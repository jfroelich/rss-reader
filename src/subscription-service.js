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
    this.readerDb = new ReaderDb();
    this.faviconService = new FaviconService();
    this.fetchTimeout = 2000;
    this.readerConn = null;
  }

  async connect() {
    const connectionsArray = await Promise.all([this.readerDb.connect(),
      this.faviconService.connect()]);
    this.readerConn = connectionsArray[0];
  }

  close() {
    if(this.readerConn)
      this.readerConn.close();
    this.faviconService.close();
  }

  // Returns the feed that was added if successful, or undefined/null if problem,
  // or throws error
  // TODO: this needs some revision, i think it should be throwing errors?
  // TODO: if redirected on fetch, check for redirect url contained in db
  // TODO: just do something like class FeedController {} ?
  async subscribe(feed) {

    // TODO: this is sloppy, just refactoring for now
    // TODO: because I need to do extra things to a feed before adding it,
    // maybe I need some other layer that does this, and that layer should
    // encapsulate feedstore
    const feedStore = new FeedStore();
    feedStore.conn = this.readerConn;


    const url = Feed.getURL(feed);
    this.log.log('Subscribing to feed with url', url);
    if(await feedStore.containsURL(url)) {
      this.log.warn('Subscription failed, already subscribed to feed with url',
        url);
      return;
    }

    if('onLine' in navigator && !navigator.onLine) {
      this.log.debug('Proceeding with offline subscription');
      return await feedStore.add(feed);
    }

    let remoteFeed;

    // TODO: why catch and return? I think I should allow this error to bubble
    // here. Might just be a remnant of when I was getting comforable with
    // async fns
    // Is fetching a fatal error or not, when online (???)
    try {
      ({remoteFeed = feed} = await ResourceLoader.fetchFeed(url,
        this.fetch_timeout));
    } catch(error) {
      this.log.warn(error);
      return;
    }

    const mergedFeed = Feed.merge(feed, remoteFeed);

    // TODO: this should be a function in feed.js
    // TODO: there is no longer a guarantee that feed.link is a valid url, this
    // needs a try/catch if a url parse error is non-fatal. That or I should
    // revise FaviconService.lookup to accept a string as input
    let lookupURL;
    if(mergedFeed.link) {
      lookupURL = new URL(mergedFeed.link);
    } else {
      const feedURL = new URL(Feed.getURL(mergedFeed));
      lookupURL = new URL(feedURL.origin);
    }

    // FaviconService lookup errors are not fatal with respect to subscribing so
    // just log a warning
    try {
      const icon_url = await this.faviconService.lookup(lookupURL);
      mergedFeed.faviconURLString = icon_url;
    } catch(error) {
      this.log.warn(error);
    }

    // TODO: once I move the feed prep work out of add feed, then feedStore.add
    // just needs to return the new id. I can set the id here and then return
    // the feed. I may not even need to return the feed.

    const addedFeed = await feedStore.add(mergedFeed);
    if(!this.suppressNotifications) {
      const feedName = addedFeed.title || Feed.getURL(addedFeed);
      const message = 'Subscribed to ' + feedName;
      DesktopNotification.show('Subscription complete', message,
        mergedFeed.faviconURLString);
    }
    return addedFeed;
  }

  async unsubscribe(feedId) {

    // TODO: these would be better as instance properties
    const feedStore = new FeedStore();
    const entryStore = new EntryStore();

    // TODO: this is sloppy
    entryStore.conn = this.readerConn;

    if(!Number.isInteger(feedId) || feedId < 1)
      throw new TypeError('Invalid feed id ' + feedId);
    this.log.log('Unsubscribing from feed', feedId);
    const tx = this.readerConn.transaction(['feed', 'entry'], 'readwrite');
    const ids = await entryStore.getIds(tx, feedId);
    this.log.debug('Preparing to remove %d entries', ids.length);
    const chan = new BroadcastChannel('db');
    const proms = ids.map((entryId) => entryStore.remove(tx, entryId, chan));
    proms.push(feedStore.remove(tx, feedId));

    try {
      await Promise.all(proms);
    } finally {
      chan.close();
    }

    this.log.debug('Unsubscribed from feed id', feedId);
    this.log.debug('Deleted %d entries', ids.length);
    return ids.length;
  }
}
