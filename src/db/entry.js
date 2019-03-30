export default function Entry() {
  this.archive_state = undefined;
  this.archived_date = undefined;
  this.author = undefined;
  this.content = undefined;
  this.created_date = undefined;
  this.read_date = undefined;
  this.updated_date = undefined;
  this.published_date = undefined;
  this.enclosure = undefined;
  this.favicon_url = undefined;
  this.feed = undefined;
  this.feed_title = undefined;
  this.id = undefined;
  this.magic = undefined;
  this.read_state = undefined;
  this.title = undefined;
  this.urls = undefined;
}

// Read states
Entry.UNREAD = 0;
Entry.READ = 1;

// Archive states
Entry.UNARCHIVED = 0;
Entry.ARCHIVED = 1;
