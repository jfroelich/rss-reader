// Reader storage module, basically a layer above rdb.js that adds functionality

import assert from "/src/utils/assert.js";
import * as Feed from "/src/storage/feed.js";
import replaceTags from "/src/html/replace-tags.js";
import htmlTruncate from "/src/html/truncate.js";
import {isPosInt} from "/src/utils/number.js";
import {filterEmptyProps} from "/src/utils/object.js";
import * as rdb from "/src/storage/rdb.js";
import {condenseWhitespace, filterControls} from "/src/utils/string.js";

export default async function feedPut(feed, conn, skipPrep) {
  assert(Feed.isFeed(feed));
  assert(rdb.isOpen(conn));

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

  const newId = await rdb.putFeed(conn, storable);
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
