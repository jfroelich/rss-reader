import {Db, Entry} from '/src/core/db.js';
import {assert} from '/src/lib/assert.js';
import {INDEFINITE} from '/src/lib/deadline.js';

// clang-format off
export {
  Entry,
  Feed,
  InvalidStateError,
  is_entry,
  is_feed,
  NotFoundError,
  ValidationError
} from '/src/core/db.js';
// clang-format on

export class CDB {
  constructor() {
    this.db = new Db();
    this.channel = undefined;
    this.channel_name = 'reader';
  }

  async open() {
    assert(typeof this.channel_name === 'string');
    await this.db.open();
    this.channel = new BroadcastChannel(this.channel_name);
  }

  close() {
    if (this.channel) {
      this.channel.close();
      this.channel = undefined;
    }

    this.db.close();
  }

  static validateFeed(feed) {
    return Db.validateFeed(feed);
  }

  static validateEntry(entry) {
    return Db.validateEntry(entry);
  }

  static sanitizeFeed(feed) {
    return Db.sanitizeFeed(feed);
  }

  static sanitizeEntry(entry) {
    return Db.sanitizeEntry(entry);
  }

  async archiveEntries(max_age) {
    const ids = await this.db.archiveEntries(max_age);
    for (const id of ids) {
      this.channel.postMessage({type: 'entry-archived', id: id});
    }
  }

  countUnreadEntriesByFeed(id) {
    return this.db.countUnreadEntriesByFeed(id);
  }

  countUnreadEntries() {
    return this.db.countUnreadEntries();
  }

  async createEntry(entry) {
    const id = await this.db.createEntry(entry);
    this.channel.postMessage({type: 'entry-created', id: id});
    return id;
  }

  async createFeed(feed) {
    const id = await this.db.createFeed(feed);
    this.channel.postMessage({type: 'feed-created', id: id});
    return id;
  }

  async createFeeds(feeds) {
    const ids = await this.db.createFeeds(feeds);
    for (const id of ids) {
      this.channel.postMessage({type: 'feed-created', id: id});
    }
    return ids;
  }

  async deleteEntry(id) {
    await this.db.deleteEntry(id);
    this.channel.postMessage({type: 'entry-deleted', id: id});
  }

  async deleteFeed(feed_id, reason) {
    const eids = await this.db.deleteFeed(feed_id);
    this.channel.postMessage(
        {type: 'feed-deleted', id: feed_id, reason: reason});

    for (const id of eids) {
      this.channel.postMessage(
          {type: 'entry-deleted', id: id, reason: reason, feed_id: feed_id});
    }
  }

  async getEntry(mode, value, key_only) {
    return this.db.getEntry(mode, value, key_only);
  }

  getEntries(mode, offset, limit) {
    return this.db.getEntries(mode, offset, limit);
  }

  getFeedIds() {
    return this.db.getFeedIds();
  }

  getFeed(mode, value, key_only) {
    return this.db.getFeed(mode, value, key_only);
  }

  getFeeds(mode, title_sort) {
    return this.db.getFeeds(mode, title_sort);
  }

  iterateEntries(handle_entry) {
    return this.db.iterateEntries(handle_entry);
  }

  queryEntries(query) {
    return this.db.queryEntries(query);
  }

  async setEntryReadState(id, read = false) {
    await this.db.setEntryReadState(id, read);
    this.channel.postMessage({type: 'entry-updated', id: id, read: true});
  }

  async updateEntry(entry) {
    const is_unread_before = entry.readState === Entry.UNREAD;
    const updated_entry = await this.db.updateEntry(entry);
    const is_read_after = updated_entry.readState === Entry.READ;
    this.channel.postMessage({
      type: 'entry-updated',
      id: updated_entry.id,
      read: is_unread_before && is_read_after
    });
  }

  async updateFeed(feed, overwrite) {
    await this.db.updateFeed(feed, overwrite);

    // TODO: do not pass the entire giant feed object through the channel.
    // Expose only those properties needed by event consumers. Also, pass those
    // properties as properties of the event itself, not a nested feed object,
    // because callers should only expect a basic event, not a full fledged
    // feed object. Also, review why it is even needed. If the only things
    // needed are things like the cleaned feed title, then maybe just expose
    // title.
    this.channel.postMessage({
      type: 'feed-updated',
      id: feed.id,
      feed: overwrite ? undefined : feed
    });
  }
}
