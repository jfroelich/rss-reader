import * as db from '/src/db/db.js';
import assert from '/lib/assert.js';
import unsubscribe from '/src/unsubscribe.js';

export default function FeedList() {
  this.listElement = undefined;
  this.noFeedsElement = undefined;

  // Optional callback caller can specify that is called every time a feed
  // is appended to the feed list with the appended feed object
  this.onappendCallback = undefined;

  this.unsubscribeCallback = undefined;
  this.activateCallback = undefined;
  this.deactivateCallback = undefined;
}

FeedList.prototype.init = async function feedListInit(parent) {
  const conn = await db.open();
  const feeds = await db.getResources({ conn, mode: 'feeds', titleSort: true });
  conn.close();

  const listElement = document.createElement('ul');
  this.listElement = listElement;
  listElement.setAttribute('id', 'feedlist');

  // Specialize generic data object as feed object
  // TODO: actually, this should be done by appendFeed
  for (const feed of feeds) {
    feed.title = feed.title || 'Untitled';
    this.appendFeed(feed);
  }

  const noFeedsElement = document.createElement('p');
  this.noFeedsElement = noFeedsElement;
  noFeedsElement.setAttribute('id', 'nosubs');
  noFeedsElement.setAttribute('class', 'option-text');
  noFeedsElement.textContent = 'No subscriptions';
  noFeedsElement.style.display = 'none';

  if (!feeds.length) {
    noFeedsElement.style.display = 'block';
    listElement.style.display = 'none';
  }

  parent.append(listElement);
  parent.append(noFeedsElement);
};

FeedList.prototype.appendFeed = function feedListAppendFeed(feed) {
  assert(feed && typeof feed === 'object');
  assert(this.listElement);

  const itemElement = document.createElement('li');
  itemElement.setAttribute('sort-key', feed.title);
  itemElement.setAttribute('feed', feed.id);
  if (feed.description) {
    itemElement.setAttribute('title', feed.description);
  }
  if (feed.active !== 1) {
    itemElement.setAttribute('inactive', 'true');
  }
  itemElement.onclick = this.itemOnclick.bind(this);

  if (feed.favicon_url) {
    const faviconElement = document.createElement('img');
    faviconElement.src = feed.favicon_url;
    if (feed.title) {
      faviconElement.title = feed.title;
    }

    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    itemElement.append(faviconElement);
  }

  const titleElement = document.createElement('span');
  const feedTitle = feed.title || db.getURLString(feed);
  // Title is automatically truncated via CSS so just produce the full value
  titleElement.textContent = feedTitle;
  itemElement.append(titleElement);

  // Append the feed into the proper position in the feed list, using the same
  // sorting order as the database would use when loading data in getResources
  const normalFeedTitle = feedTitle.toLowerCase();
  let inserted = false;
  for (const childNode of (this.listElement.childNodes)) {
    const sortKeyString = childNode.getAttribute('sort-key') || '';

    if (indexedDB.cmp(normalFeedTitle, sortKeyString.toLowerCase()) < 1) {
      this.listElement.insertBefore(itemElement, childNode);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    this.listElement.append(itemElement);
  }

  if (this.onappendCallback) {
    this.onappendCallback(feed);
  }
};

FeedList.prototype.count = function feedListCount() {
  return this.listElement.childElementCount;
};

// TODO: refactor as list click handler instead of per item
FeedList.prototype.itemOnclick = async function feedListItemOnclick(event) {
  const itemElement = event.currentTarget;
  const feedId = parseInt(itemElement.getAttribute('feed'), 10);

  const conn = await db.open();
  const feed = await db.getResource({
    conn, mode: 'id', id: feedId, keyOnly: false
  });
  conn.close();

  const detailsTitleElement = document.getElementById('details-title');
  detailsTitleElement.textContent = feed.title || db.getURLString(feed);

  const detailsFaviconElement = document.getElementById('details-favicon');
  if (feed.favicon_url) {
    detailsFaviconElement.setAttribute('src', feed.favicon_url);
  } else {
    // TODO: set to default icon
    detailsFaviconElement.removeAttribute('src');
  }

  const detailsDescriptionElement = document.getElementById('details-feed-description');
  detailsDescriptionElement.textContent = feed.description || '';

  const feedURLElement = document.getElementById('details-feed-url');
  feedURLElement.textContent = db.getURLString(feed);

  const feedLinkElement = document.getElementById('details-feed-link');
  feedLinkElement.textContent = feed.link || '';

  const unsubscribeButton = document.getElementById('details-unsubscribe');
  unsubscribeButton.value = `${feed.id}`;
  unsubscribeButton.onclick = this.unsubscribeButtonOnclick.bind(this);

  const activateButton = document.getElementById('details-activate');
  activateButton.value = `${feed.id}`;
  activateButton.disabled = feed.active === 1;
  activateButton.onclick = this.activateOnclick.bind(this);

  const deactivateButton = document.getElementById('details-deactivate');
  deactivateButton.value = `${feed.id}`;
  deactivateButton.disabled = feed.active !== 1;
  deactivateButton.onclick = this.deactivateOnclick.bind(this);

  if (this.onclickCallback) {
    this.onclickCallback(event);
  }
};

FeedList.prototype.unsubscribeButtonOnclick = async function (event) {
  const feedId = parseInt(event.target.value, 10);

  const conn = await db.open();
  await unsubscribe(conn, feedId);
  conn.close();

  this.removeFeedById(feedId);

  if (this.unsubscribeCallback) {
    this.unsubscribeCallback(feedId);
  }
};

FeedList.prototype.removeFeedById = function feedListRemoveFeedById(feedId) {
  const itemElement = this.listElement.querySelector(`li[feed="${feedId}"]`);
  assert(itemElement);

  itemElement.removeEventListener('click', this.itemOnclick);
  itemElement.remove();

  if (!this.listElement.childElementCount) {
    this.listElement.style.display = 'none';
    this.noFeedsElement.style.display = 'block';
  }

  if (this.onremoveCallback) {
    this.onremoveCallback(feedId);
  }
};

// TODO: handling the event here may be wrong, it should be done in the
// channel message handler. However, I am not sure how much longer the options
// page is sticking around so defering this change
FeedList.prototype.activateOnclick = async function feedListActivateOnclick(event) {
  const feedId = parseInt(event.target.value, 10);

  const conn = await db.open();
  await db.patchResource(conn, { id: feedId, active: 1 });
  conn.close();

  // Mark the corresponding feed element loaded in the view as active
  const itemElement = this.listElement.querySelector(`li[feed="${feedId}"]`);

  // It may not be loaded (e.g. it may be removed)
  if (itemElement) {
    itemElement.removeAttribute('inactive');
  }

  if (this.activateCallback) {
    this.activateCallback(feedId);
  }
};

FeedList.prototype.deactivateOnclick = async function feedListDeactivateOnclick(event) {
  const feedId = parseInt(event.target.value, 10);
  const conn = await db.open();
  const props = { id: feedId, active: 0, deactivation_reason: 'manual' };
  await db.patchResource(conn, props);
  conn.close();

  // TODO: this should be done in the channel message handler instead of here
  // Deactivate the corresponding element in the view
  const itemElement = this.listElement.querySelector(`li[feed="${feedId}"]`);
  if (itemElement) {
    itemElement.setAttribute('inactive', 'true');
  }

  if (this.deactivateCallback) {
    this.deactivateCallback(feedId);
  }
};
