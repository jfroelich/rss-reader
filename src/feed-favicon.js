// See license.md

'use strict';

class FeedFavicon {

  constructor() {
    this.verbose = false;
    this.readerDb = new ReaderDb();
    this.feedStore = new FeedStore();
    this.fs = new FaviconService();
  }

  static async createAlarm(periodInMinutes) {
    const alarm = await ExtensionUtils.getAlarm('refresh-feed-icons');
    if(alarm)
      return;

    console.debug('Creating refresh-feed-icons alarm');
    chrome.alarms.create('refresh-feed-icons',
      {'periodInMinutes': periodInMinutes});

  }

  static registerAlarmListener() {
    chrome.alarms.onAlarm.addListener(this.onAlarm);
  }

  static async onAlarm(alarm) {
    if(alarm.name !== 'refresh-feed-icons')
      return;

    const ff = new FeedFavicon();
    try {
      let result = await ff.refresh();
    } catch(error) {
      console.warn(error);
    }
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
      numModified = resolutions.reduce((c, r) => r ? c + 1 : c, 0);
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
      // Do not assume the link is valid
      try {
        return new URL(feed.link);
      } catch(error) {
        console.warn(error);
      }
    }

    // If the link is missing or invalid then use the origin
    const feedURL = Feed.getURL(feed);
    const origin = new URL(feedURL).origin;
    return new URL(origin);
  }
}
