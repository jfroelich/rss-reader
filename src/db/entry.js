import * as types from '/src/db/types.js';

export default function Entry() {
  this.magic = types.ENTRY_MAGIC;
  this.id = undefined;
  this.author = undefined;
  this.title = undefined;
  this.content = undefined;
  this.readState = undefined;
  this.urls = undefined;
  this.feed = undefined;
  this.archiveState = undefined;
  this.dateCreated = undefined;
  this.dateUpdated = undefined;
  this.datePublished = undefined;
  this.enclosure = undefined;
  this.faviconURLString = undefined;
}

// Read states
Entry.UNREAD = 0;
Entry.READ = 1;

// Archive states
Entry.UNARCHIVED = 0;
Entry.ARCHIVED = 1;
