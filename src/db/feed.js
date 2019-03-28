import * as types from '/src/db/types.js';

export default function Feed() {
  this.magic = types.FEED_MAGIC;
  this.id = undefined;
  this.active = false;
  this.title = undefined;
  this.type = undefined;
  this.link = undefined;
  this.description = undefined;
  this.deactivation_reason = undefined;
  this.deactivation_date = undefined;
  this.created_date = undefined;
  this.updated_date = undefined;
  this.published_date = undefined;
  this.favicon_url = undefined;
  this.urls = undefined;
}
