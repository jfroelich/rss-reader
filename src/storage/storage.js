// Reader storage module, basically a layer above rdb.js that adds functionality

// TODO: maybe break into two modules, feed-store.js, and entry-store.js, that are basically
// abstractions around rdb calls.

import assert from "/src/utils/assert.js";
import * as Entry from "/src/storage/entry.js";
import * as Feed from "/src/storage/feed.js";
import replaceTags from "/src/html/replace-tags.js";
import htmlTruncate from "/src/html/truncate.js";
import {isPosInt} from "/src/utils/number.js";
import {filterEmptyProps} from "/src/utils/object.js";
import * as rdb from "/src/storage/rdb.js";
import {condenseWhitespace, filterControls} from "/src/utils/string.js";

export async function feedPut(feed, conn, skipPrep) {
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

// Returns a shallow copy of the input feed with sanitized properties
function sanitizeFeed(feed, titleMaxLength, descMaxLength) {
  assert(Feed.isFeed(feed));

  const DEFAULT_TITLE_MAX_LEN = 1024;
  const DEFAULT_DESC_MAX_LEN = 1024 * 10;

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


export async function entryAdd(entry, conn) {
  assert(Entry.isEntry(entry));
  assert(rdb.isOpen(conn));
  const sanitized = entrySanitize(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = Entry.STATE_UNREAD;
  storable.archiveState = Entry.STATE_UNARCHIVED;
  storable.dateCreated = new Date();
  await rdb.putEntry(conn, storable);
}

// Returns a new entry object where fields have been sanitized. Impure
function entrySanitize(inputEntry, authorMaxLength, titleMaxLength, contextMaxLength) {
  assert(Entry.isEntry(inputEntry));

  if(typeof authorMaxLength === 'undefined') {
    authorMaxLength = 200;
  }

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1000;
  }

  if(typeof contextMaxLength === 'undefined') {
    contextMaxLength = 50000;
  }

  assert(isPosInt(authorMaxLength));
  assert(isPosInt(titleMaxLength));
  assert(isPosInt(contextMaxLength));

  const outputEntry = Object.assign({}, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = filterControls(author);
    author = replaceTags(author, '');
    author = condenseWhitespace(author);
    author = htmlTruncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  if(outputEntry.content) {
    let content = outputEntry.content;
    content = htmlTruncate(content, contextMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControls(title);
    title = replaceTags(title, '');
    title = condenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}
