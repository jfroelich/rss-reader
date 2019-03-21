import * as types from '/src/db/types.js';

export default function Feed() {
  this.magic = types.FEED_MAGIC;
  this.id = undefined;
  this.active = false;
  this.title = undefined;
  this.type = undefined;
  this.link = undefined;
  this.description = undefined;
  this.deactivationReasonText = undefined;
  this.deactivateDate = undefined;
  this.dateCreated = undefined;
  this.dateUpdated = undefined;
  this.datePublished = undefined;
  this.faviconURLString = undefined;
  this.urls = undefined;
}
