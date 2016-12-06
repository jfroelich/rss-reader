// See license.md

'use strict';

class FeedFavicon {

  constructor() {
    this.verbose = false;
    this.readerDb = new ReaderDb();
    this.feedStore = new FeedStore();
    this.fs = new FaviconService();
  }

  async refresh() {
    if(this.verbose)
      console.log('Refreshing feed favicons...');
    let numModified = 0;

    try {
      await this.openConnections();
      const feeds = await this.feedStore.getAll();
      const updatePromises = feeds.map(this.updateFeedFavicon, this);
      const resolutions = await Promise.all(updatePromises);
      numModified = resolutions.reduce((c,r) => r ? c + 1 : c, 0);
    } finally {
      this.closeConnections();
    }

    if(this.verbose)
      console.log('Refreshed feed favicons. Modified %d', numModified);
  }

  async openConnections() {
    const connections = await Promise.all([this.readerDb.connect(),
      this.fs.connect()]);
    this.feedStore.conn = connections[0];
  }

  closeConnections() {
    this.fs.close();
    if(this.feedStore.conn)
      this.feedStore.conn.close();
  }

  async updateFeedFavicon(feed) {
    const lookupURL = FeedFavicon.getLookupURL(feed);
    const iconURL = await this.fs.lookup(lookupURL);
    if(!iconURL)
      return false;
    if(feed.faviconURLString === iconURL)
      return false;

    feed.faviconURLString = iconURL;
    await this.feedStore.put(feed);
    return true;
  }

  static getLookupURL(feed) {
    if(feed.link) {
      try {
        return new URL(feed.link);
      } catch(error) {
        console.warn(error);
      }
    }

    const feedURL = Feed.getURL(feed);
    const origin = new URL(feedURL).origin;
    return new URL(origin);
  }
}
