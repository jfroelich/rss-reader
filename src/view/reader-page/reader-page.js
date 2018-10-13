import * as db from '/src/db/db.js';

let current_view = 'article-list';
let current_view_feed_id = db.INVALID_FEED_ID;

async function article_list_init(session) {
  current_view = 'article-list';
  await article_list_refresh(session);
}

async function article_list_refresh(session) {
  // TODO: this may be called on a list that already has stuff in it.
  // temporarily just write it as if nothing was there, i am still confused
  // as to how this will all look


  const query = {};
  query.feed_id = current_view_feed_id;
  query.sort_property = 'dateCreated';
  query.sort_order = 'next';
  query.offset = 0;
  query.read_state = undefined;  // read or unread

  // TODO: this should probably be limited, right?
  query.limit = 0;  // unlimited



  const article_list_element = document.getElementById('article-list');
}


function truncate_string(value, length, suffix) {
  if (value.length <= length) {
    return value;
  }
  return value.substring(0, length) + (suffix || '');
}

// Load the list of feeds in the left panel
async function left_pane_init(session) {
  const list_element = document.getElementById('feed-list');

  const loading_element = document.createElement('li');
  loading_element.setAttribute('id', 'feed-list-load-progress');
  const progress_element = document.createElement('progress');
  loading_element.appendChild(progress_element);
  list_element.appendChild(loading_element);

  const total_unread_count = await db.count_unread_entries(session);

  const all_feeds_item_element = document.createElement('li');
  const all_feeds_item_text_element = document.createElement('span');
  all_feeds_item_text_element.textContent = 'All sources';
  all_feeds_item_element.appendChild(all_feeds_item_text_element);

  if (total_unread_count) {
    all_feeds_item_text_element.classList.add('bold-item');

    const all_feeds_unread_count_element = document.createElement('span');
    const display_count =
        total_unread_count > 1000 ? '999+' : '' + total_unread_count;
    all_feeds_unread_count_element.textContent = ' (' + display_count + ')';
    all_feeds_item_element.appendChild(all_feeds_unread_count_element);
  }

  list_element.appendChild(all_feeds_item_element);

  const feeds = await db.get_feeds(session, 'active', true);

  // Load the unread count for each feed
  const unread_promises = [];
  for (const feed of feeds) {
    const promise = db.count_unread_entries_by_feed(session, feed.id);
    unread_promises.push(promise);
  }
  const unread_counts = await Promise.all(unread_promises);

  // Stash the unread count in the feed object. Even though the promises may
  // have resolved out of order, the order in which the promises were invoked
  // is maintained, so the index into each array corresponds.
  for (let i = 0, len = unread_counts.length; i < len; i++) {
    feeds[i].unread_count = unread_counts[i];
  }

  const default_favicon_url =
      chrome.extension.getURL('/images/rss_icon_trans.gif');

  for (const feed of feeds) {
    const item_element = document.createElement('li');

    const icon_element = document.createElement('img');
    let fus = feed.faviconURLString || default_favicon_url;
    icon_element.setAttribute('src', fus);
    icon_element.setAttribute('width', '16px');
    icon_element.setAttribute('height', '16px');
    item_element.appendChild(icon_element);

    const title = feed.title || '';
    const title_element = document.createElement('span');
    title_element.setAttribute('title', title);
    title_element.textContent = title;
    item_element.appendChild(title_element);

    if (feed.unread_count) {
      title_element.classList.add('bold-item');
      const feed_unread_count_element = document.createElement('span');
      feed_unread_count_element.textContent = ' (' + feed.unread_count + ')';
      item_element.appendChild(feed_unread_count_element);
    }

    list_element.appendChild(item_element);
  }

  loading_element.remove();
}

async function init() {
  const session = await db.open();
  await left_pane_init(session);
  await article_list_init(session);
  session.close();
}

init().catch(console.warn);
