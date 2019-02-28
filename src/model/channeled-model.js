import {assert} from '/src/lib/assert.js';
import {INDEFINITE} from '/src/lib/deadline.js';
import {Entry} from '/src/model/entry.js';
import {Model} from '/src/model/model.js';

export {InvalidStateError, NotFoundError, ValidationError} from '/src/model/model.js';

export function ChanneledModel() {
  // This should point to a class that implements the unspecified Channel
  // interface. This should be set prior to calling open.
  this.channel_class = BroadcastChannel;

  this.db = new Model();
  this.channel = undefined;
  this.channel_name = 'reader';
}

ChanneledModel.prototype.open = async function() {
  assert(this.channel_class);
  assert(typeof this.channel_name === 'string');
  await this.db.open();
  this.channel = new this.channel_class(this.channel_name);
};

ChanneledModel.prototype.close = function() {
  if (this.channel) {
    this.channel.close();
    this.channel = undefined;
  }

  this.db.close();
};

ChanneledModel.validateFeed = function(feed) {
  return Model.validateFeed(feed);
};

ChanneledModel.validateEntry = function(entry) {
  return Model.validateEntry(entry);
};

ChanneledModel.sanitizeFeed = function(feed) {
  return Model.sanitizeFeed(feed);
};

ChanneledModel.sanitizeEntry = function(entry) {
  return Model.sanitizeEntry(entry);
};

ChanneledModel.prototype.archiveEntries = async function(max_age) {
  const ids = await this.db.archiveEntries(max_age);
  for (const id of ids) {
    this.channel.postMessage({type: 'entry-archived', id: id});
  }
};

ChanneledModel.prototype.countUnreadEntriesByFeed = function(id) {
  return this.db.countUnreadEntriesByFeed(id);
};

ChanneledModel.prototype.countUnreadEntries = function() {
  return this.db.countUnreadEntries();
};

ChanneledModel.prototype.createEntry = async function(entry) {
  const id = await this.db.createEntry(entry);
  this.channel.postMessage({type: 'entry-created', id: id});
  return id;
};

ChanneledModel.prototype.createFeed = async function(feed) {
  const id = await this.db.createFeed(feed);
  this.channel.postMessage({type: 'feed-created', id: id});
  return id;
};

ChanneledModel.prototype.createFeeds = async function(feeds) {
  const ids = await this.db.createFeeds(feeds);
  for (const id of ids) {
    this.channel.postMessage({type: 'feed-created', id: id});
  }
  return ids;
};

ChanneledModel.prototype.deleteEntry = async function(id) {
  await this.db.deleteEntry(id);
  this.channel.postMessage({type: 'entry-deleted', id: id});
};

ChanneledModel.prototype.deleteFeed = async function(feed_id, reason) {
  const eids = await this.db.deleteFeed(feed_id);
  this.channel.postMessage({type: 'feed-deleted', id: feed_id, reason: reason});

  for (const id of eids) {
    this.channel.postMessage(
        {type: 'entry-deleted', id: id, reason: reason, feed_id: feed_id});
  }
};

ChanneledModel.prototype.getEntry = async function(mode, value, key_only) {
  return this.db.getEntry(mode, value, key_only);
};

ChanneledModel.prototype.getEntries = function(mode, offset, limit) {
  return this.db.getEntries(mode, offset, limit);
};

ChanneledModel.prototype.getFeedIds = function() {
  return this.db.getFeedIds();
};

ChanneledModel.prototype.getFeed = function(mode, value, key_only) {
  return this.db.getFeed(mode, value, key_only);
};

ChanneledModel.prototype.getFeeds = function(mode, title_sort) {
  return this.db.getFeeds(mode, title_sort);
};

ChanneledModel.prototype.iterateEntries = function(handle_entry) {
  return this.db.iterateEntries(handle_entry);
};

ChanneledModel.prototype.queryEntries = function(query) {
  return this.db.queryEntries(query);
};

ChanneledModel.prototype.setEntryReadState = async function(id, read = false) {
  await this.db.setEntryReadState(id, read);
  this.channel.postMessage({type: 'entry-updated', id: id, read: true});
};

ChanneledModel.prototype.updateEntry = async function(entry) {
  const is_unread_before = entry.readState === Entry.UNREAD;
  const updated_entry = await this.db.updateEntry(entry);
  const is_read_after = updated_entry.readState === Entry.READ;
  this.channel.postMessage({
    type: 'entry-updated',
    id: updated_entry.id,
    read: is_unread_before && is_read_after
  });
};

// TODO: do not pass the entire giant feed object through the channel. Expose
// only those properties needed by event consumers. Also, pass those properties
// as properties of the event itself, not a nested feed object, because callers
// should only expect a basic event, not a full fledged feed object. Also,
// review why it is even needed. If the only things needed are things like the
// cleaned feed title, then maybe just expose title.
ChanneledModel.prototype.updateFeed = async function(feed, overwrite) {
  await this.db.updateFeed(feed, overwrite);
  this.channel.postMessage(
      {type: 'feed-updated', id: feed.id, feed: overwrite ? undefined : feed});
};
