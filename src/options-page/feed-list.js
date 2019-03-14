import {assert} from '/src/assert.js';
import {Model} from '/src/model/model.js';
import activate_feed from '/src/model/ops/activate-feed.js';
import deactivate_feed from '/src/model/ops/deactivate-feed.js';
import get_feed from '/src/model/ops/get-feed.js';
import {Feed} from '/src/model/types/feed.js';
import {unsubscribe} from '/src/ops/unsubscribe.js';

export function FeedList() {
  this.list_element = undefined;
  this.no_feeds_element = undefined;

  // Optional callback caller can specify that is called every time a feed
  // is appended to the feed list with the appended Feed object
  this.onappend_callback = undefined;

  this.unsubscribe_callback = undefined;
  this.activate_callback = undefined;
  this.deactivate_callback = undefined;
}

FeedList.prototype.init = async function(parent) {
  const model = new Model();
  await model.open();
  const feeds = await model.getFeeds('all', true);
  model.close();


  const list_element = document.createElement('ul');
  this.list_element = list_element;
  list_element.setAttribute('id', 'feedlist');

  for (let feed of feeds) {
    // Specialize generic data object as model/Feed object
    feed = Object.assign(new Feed(), feed);
    // TODO: actually, this should be done by appendFeed
    feed.title = feed.title || 'Untitled';
    this.appendFeed(feed);
  }


  const no_feeds_element = document.createElement('p');
  this.no_feeds_element = no_feeds_element;
  no_feeds_element.setAttribute('id', 'nosubs');
  no_feeds_element.setAttribute('class', 'option-text');
  no_feeds_element.textContent = 'No subscriptions';
  no_feeds_element.style.display = 'none';


  if (!feeds.length) {
    no_feeds_element.style.display = 'block';
    list_element.style.display = 'none';
  }

  parent.appendChild(list_element);
  parent.appendChild(no_feeds_element);
};

FeedList.prototype.appendFeed = function(feed) {
  assert(feed instanceof Feed);
  assert(this.list_element);

  const item_element = document.createElement('li');
  item_element.setAttribute('sort-key', feed.title);
  item_element.setAttribute('feed', feed.id);
  if (feed.description) {
    item_element.setAttribute('title', feed.description);
  }
  if (feed.active !== true) {
    item_element.setAttribute('inactive', 'true');
  }
  item_element.onclick = this.itemOnclick.bind(this);

  if (feed.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.src = feed.faviconURLString;
    if (feed.title) {
      favicon_element.title = feed.title;
    }

    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    item_element.appendChild(favicon_element);
  }

  const title_element = document.createElement('span');
  const feed_title = feed.title || feed.getURLString();
  // Title is automatically truncated via CSS so just produce the full value
  title_element.textContent = feed_title;
  item_element.appendChild(title_element);

  // Append the feed into the proper position in the feed list, using the same
  // sorting order as the database would use when loading data in getFeeds
  const normal_title = feed_title.toLowerCase();
  let inserted = false;
  for (const child_node of (this.list_element.childNodes)) {
    const key_string = child_node.getAttribute('sort-key') || '';

    if (indexedDB.cmp(normal_title, key_string.toLowerCase()) < 1) {
      this.list_element.insertBefore(item_element, child_node);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    this.list_element.appendChild(item_element);
  }

  if (this.onappend_callback) {
    this.onappend_callback(feed);
  }
};

FeedList.prototype.count = function() {
  return this.list_element.childElementCount;
};

// TODO: refactor as list click handler instead of per item
FeedList.prototype.itemOnclick = async function(event) {
  const item_element = event.currentTarget;
  const feed_id = parseInt(item_element.getAttribute('feed'), 10);

  const model = new Model();
  await model.open();
  let feed = await get_feed(model, 'id', feed_id, false);
  model.close();

  feed = Object.assign(new Feed(), feed);

  const details_title_element = document.getElementById('details-title');
  details_title_element.textContent = feed.title || feed.getURLString();

  const details_favicon_element = document.getElementById('details-favicon');
  if (feed.faviconURLString) {
    details_favicon_element.setAttribute('src', feed.faviconURLString);
  } else {
    // TODO: set to default icon
    details_favicon_element.removeAttribute('src');
  }

  const details_desc_element =
      document.getElementById('details-feed-description');
  details_desc_element.textContent = feed.description || '';

  const feed_url_element = document.getElementById('details-feed-url');
  feed_url_element.textContent = feed.getURLString();

  const feed_link_element = document.getElementById('details-feed-link');
  feed_link_element.textContent = feed.link || '';

  const unsubscribe_button = document.getElementById('details-unsubscribe');
  unsubscribe_button.value = '' + feed.id;
  unsubscribe_button.onclick = this.unsubscribeButtonOnclick.bind(this);

  const activate_button = document.getElementById('details-activate');
  activate_button.value = '' + feed.id;
  activate_button.disabled = feed.active === true ? true : false;
  activate_button.onclick = this.activateOnclick.bind(this);

  const deactivate_button = document.getElementById('details-deactivate');
  deactivate_button.value = '' + feed.id;
  deactivate_button.disabled = feed.active === false ? true : false;
  deactivate_button.onclick = this.deactivateOnclick.bind(this);

  if (this.onclick_callback) {
    this.onclick_callback(event);
  }
};

FeedList.prototype.unsubscribeButtonOnclick = async function(event) {
  const feed_id = parseInt(event.target.value, 10);

  const model = new Model();
  await model.open();
  await unsubscribe(model, feed_id);
  model.close();

  this.removeFeedById(feed_id);

  if (this.unsubscribe_callback) {
    this.unsubscribe_callback(feed_id);
  }
};

FeedList.prototype.removeFeedById = function(feed_id) {
  const item_element = this.list_element.querySelector(`li[feed="${feed_id}"]`);
  assert(item_element);

  item_element.removeEventListener('click', this.itemOnclick);
  item_element.remove();

  if (!this.list_element.childElementCount) {
    this.list_element.style.display = 'none';
    this.no_feeds_element.style.display = 'block';
  }

  if (this.onremove_callback) {
    this.onremove_callback(feed_id);
  }
};

// TODO: handling the event here may be wrong, it should be done in the
// channel message handler. However, I am not sure how much longer the options
// page is sticking around so defering this change
FeedList.prototype.activateOnclick = async function(event) {
  const feed_id = parseInt(event.target.value, 10);

  const model = new Model();
  await model.open();
  await activate_feed(model, feed_id);
  model.close();

  // Mark the corresponding feed element loaded in the view as active
  const item_element =
      this.list_element.querySelector('li[feed="' + feed_id + '"]');

  // It may not be loaded (e.g. it may be removed)
  if (item_element) {
    item_element.removeAttribute('inactive');
  }

  if (this.activate_callback) {
    this.activate_callback(feed_id);
  }
};

// TODO: this should be done in the channel message handler instead of here
FeedList.prototype.deactivateOnclick = async function(event) {
  const feed_id = parseInt(event.target.value, 10);

  const model = new Model();
  await model.open();
  await deactivate_feed(model, feed_id, 'manual');
  model.close();

  // Deactivate the corresponding element in the view
  const item_element =
      this.list_element.querySelector('li[feed="' + feed_id + '"]');
  if (item_element) {
    item_element.setAttribute('inactive', 'true');
  }

  if (this.deactivate_callback) {
    this.deactivate_callback(feed_id);
  }
};
