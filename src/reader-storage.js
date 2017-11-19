// Reader storage module, basically a layer above rdb.js that adds functionality

// TODO: maybe break into two modules, feed-store.js, and entry-store.js, that are basically
// abstractions around rdb calls.

import assert from "/src/utils/assert.js";
import * as Entry from "/src/entry.js";
import * as Feed from "/src/feed.js";
import {replaceTags, truncate as htmlTruncate} from "/src/utils/html.js";
import {isPosInt} from "/src/utils/number.js";
import {filterEmptyProps} from "/src/utils/object.js";
import * as rdb from "/src/rdb.js";
import {filterControls, condenseWhitespace} from "/src/utils/string.js";

export async function feedPut(feed, conn, skipPrep) {
  assert(Feed.isFeed(feed));
  assert(rdb.isOpen(conn));

  let storable;
  if(skipPrep) {
    storable = feed;
  } else {
    storable = Feed.sanitize(feed);
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
