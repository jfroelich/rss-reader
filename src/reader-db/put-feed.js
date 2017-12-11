import assert from "/src/assert/assert.js";
import replaceTags from "/src/html/replace-tags.js";
import htmlTruncate from "/src/html/truncate.js";
import * as Feed from "/src/reader-db/feed.js";
import condenseWhitespace from "/src/string/condense-whitespace.js";
import filterControls from "/src/string/filter-controls.js";
import filterEmptyProps from "/src/utils/filter-empty-props.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import isPosInt from "/src/utils/is-pos-int.js";

// TODO: I do not like the skipPrep parameter. Essentially there should be two functions. A
// function that preps the feed, and a function that stores the feed as is. If the caller wants to
// prep the feed, call both functions. If the caller wants to just store the feed, only call the
// second function. That would be better than this.
// Furthermore, the prep function should be a simple sync helper function. It shouldn't even be
// in this module, it should be in a separate module. Second, it should return the prepped feed.
// Third, because it returns the prepped feed, the caller then has the modified feed data right
// there available to the caller, which removes the need to return or modify the input feed
// object when storing the feed. That means that this should be changed to just return the new id
// if set, and not the modified feed data.

// TODO: maybe this should be refactored as a non-async, promise-returning function. There is no
// need to use async-await when this is basically a wrapped call to another promise-returning
// function. But note the above todo that I added later, the prep feed function would take care
// of this concern by becoming a separate function, and basically this concern would not longer be
// a concern.

// TODO: should conn be first parameter? Which organizing characteristic is controlling? I think
// the fact that this is a database helper function is a more important characteristic than the
// fact that this operates on a feed. Therefore it would be more consistent with other database
// helper function APIs/surface-area/whachamacallit if conn was the first parameter.

export default async function putFeed(feed, conn, skipPrep) {
  assert(Feed.isFeed(feed));
  assert(IndexedDbUtils.isOpen(conn));

  let storable;
  if(skipPrep) {
    storable = feed;
  } else {
    storable = sanitizeFeed(feed);
    storable = filterEmptyProps(storable);
  }

  // If the feed is missing the 'active' property, add the property with the default value of
  // true. This generally only occurs when adding a new feed to the database. Newly added feeds are
  // assumed to be active. If caller needs to add feed as inactive, then caller simply needs to
  // set the active property as false. That is why this only sets if missing or undefined. Notable
  // the caller should not expect feed to be inactive by not setting the active property.

  if(!('active' in storable) || typeof storable.active === 'undefined') {
    storable.active = true;

    // If the feed was missing the property or it was invalid the feed shouldn't also have
    // other props. This is really a job for some kind of validateFeed helper function but for now
    // just take a quick look with a non-throwing sanity check.
    console.assert(!('deactivationReasonText' in storable));
    console.assert(!('deactivationDate' in storable));
  }

  const currentDate = new Date();
  if(!('dateCreated' in storable)) {
    storable.dateCreated = currentDate;
  }
  storable.dateUpdated = currentDate;

  const newId = await putFeedRaw(conn, storable);
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
function putFeedRaw(conn, feed) {
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
