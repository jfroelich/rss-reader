import assert from "/src/assert.js";
import replaceTags from "/src/html/replace-tags.js";
import htmlTruncate from "/src/html/truncate.js";
import * as Feed from "/src/storage/feed.js";
import * as rdb from "/src/storage/rdb.js";
import filterEmptyProps from "/src/utils/filter-empty-props.js";
import * as idb from "/src/utils/indexeddb-utils.js";
import isPosInt from "/src/utils/is-pos-int.js";
import {condenseWhitespace, filterControls} from "/src/utils/string.js";

// TODO: maybe this should be refactored as a non-async, promise-returning function. There is no
// need to use async-await when this is basically a wrapped call to another promise-returning
// function.

export default async function feedPut(feed, conn, skipPrep) {
  assert(Feed.isFeed(feed));
  assert(idb.isOpen(conn));

  let storable;
  if(skipPrep) {
    storable = feed;
  } else {
    storable = sanitizeFeed(feed);
    storable = filterEmptyProps(storable);
  }

  const currentDate = new Date();
  if(!('dateCreated' in storable)) {
    storable.dateCreated = currentDate;
  }
  storable.dateUpdated = currentDate;

  const newId = await putFeedInDb(conn, storable);
  storable.id = newId;
  return storable;
}

const DEFAULT_TITLE_MAX_LEN = 1024;
const DEFAULT_DESC_MAX_LEN = 1024 * 10;

// Returns a shallow copy of the input feed with sanitized properties
function sanitizeFeed(feed, titleMaxLength, descMaxLength) {
  assert(Feed.isFeed(feed));

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = DEFAULT_TITLE_MAX_LEN;
  } else {
    assert(isPosInt(titleMaxLength));
  }

  if(typeof descMaxLength === 'undefined') {
    descMaxLength = DEFAULT_DESC_MAX_LEN;
  } else {
    assert(isPosInt(descMaxLength));
  }

  const outputFeed = Object.assign({}, feed);
  const tagReplacement = '';
  const suffix = '';

  if(outputFeed.title) {
    let title = outputFeed.title;
    title = filterControls(title);
    title = replaceTags(title, tagReplacement);
    title = condenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength, suffix);
    outputFeed.title = title;
  }

  if(outputFeed.description) {
    let desc = outputFeed.description;
    desc = filterControls(desc);
    desc = replaceTags(desc, tagReplacement);
    desc = condenseWhitespace(desc);
    desc = htmlTruncate(desc, descMaxLength, suffix);
    outputFeed.description = desc;
  }

  return outputFeed;
}

// Adds or overwrites a feed in storage. Resolves with the new feed id if add.
// There are no side effects other than the database modification.
// @param conn {IDBDatabase} an open database connection
// @param feed {Object} the feed object to add
// @return {Promise} a promise that resolves to the id of the stored feed
function putFeedInDb(conn, feed) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => {
      const feedId = request.result;
      resolve(feedId);
    };
    request.onerror = () => reject(request.error);
  });
}
