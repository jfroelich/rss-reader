import * as types from '/src/db/types.js';

export default function Feed() {
  this.magic = types.FEED_MAGIC;
  this.id = undefined;
  this.active = false;
  this.title = undefined;
  this.type = undefined;
  this.link = undefined;
  this.description = undefined;
  this.deactivation_reason_text = undefined;
  this.deactivate_date = undefined;
  this.date_created = undefined;
  this.date_updated = undefined;
  this.date_published = undefined;
  this.favicon_url_string = undefined;
  this.urls = undefined;
}
