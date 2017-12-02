import assert from "/src/assert/assert.js";
import * as Entry from "/src/reader-db/entry.js";
import replaceTags from "/src/html/replace-tags.js";
import htmlTruncate from "/src/html/truncate.js";
import isPosInt from "/src/utils/is-pos-int.js";
import filterEmptyProps from "/src/utils/filter-empty-props.js";
import putEntryInDb from "/src/reader-db/put-entry.js";
import {isOpen as isOpenDb} from "/src/utils/indexeddb-utils.js";
import {condenseWhitespace, filterControls} from "/src/utils/string.js";


// TODO: the message format should be defined externally so that it is consistent. I think this is
// what is meant by a 'protocol'? So maybe there should be some protocol module where a standard
// message object format is defined, and this uses that or something? For now just get it working
// with per-call custom message.

// TODO: this should probably return the newly added entry instead of its id, to let caller decide
// what to do with the info? Or is id always sufficient?

// TODO: this does not need to be async, this can be a promise returning function

// @param channel {BroadcastChannel} optional, if defined an 'entry-added' type message will be
// sent to the channel with the new entry's id
// @return {Number} the id of the added entry
export default async function entryAdd(entry, conn, channel) {
  assert(Entry.isEntry(entry));
  assert(isOpenDb(conn));
  const sanitized = entrySanitize(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = Entry.STATE_UNREAD;
  storable.archiveState = Entry.STATE_UNARCHIVED;
  storable.dateCreated = new Date();
  const newEntryId = await putEntryInDb(conn, storable);

  // If a channel was provided, send a message
  if(channel) {
    const message = {type: 'entry-added', id: newEntryId};

    // TEMP: debugging new messaging
    console.debug('Sending entry-added message %o to channel', message, channel.name);

    channel.postMessage(message);
  }

  return newEntryId;
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

  const blankEntry = Entry.createEntry();
  const outputEntry = Object.assign(blankEntry, inputEntry);

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
