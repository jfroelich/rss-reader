import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import * as Entry from "/src/reader-db/entry.js";
import replaceTags from "/src/html/replace-tags.js";
import htmlTruncate from "/src/html/truncate.js";
import isPosInt from "/src/utils/is-pos-int.js";
import filterEmptyProps from "/src/utils/filter-empty-props.js";
import condenseWhitespace from "/src/string/condense-whitespace.js";
import filterUnprintableCharacters from "/src/string/filter-unprintable-characters.js";
import {isOpen as isOpenDb} from "/src/indexeddb/utils.js";
import filterControls from "/src/string/filter-controls.js";

// TODO: the message format should be defined externally so that it is consistent. I think this is
// what is meant by a 'protocol'? So maybe there should be some protocol module where a standard
// message object format is defined, and this uses that or something? For now just get it working
// with per-call custom message.

// TODO: this should probably return the newly added entry instead of its id, to let caller decide
// what to do with the info? Or is id always sufficient?

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

  // TEMP: hack
  const store = new FeedStore();
  store.conn = conn;

  const newEntryId = await store.putEntry(storable);

  // If the above call to putEntryInDb did not throw an exception, then the entry storage operation
  // committed, so it is safe to notify listeners of the model change. If a channel was provided,
  // send a message. The reason entryAdd is async is so that the above call can be awaited and
  // guarantee this message is only sent on resolution, and not prior to settling where there is
  // still the chance of rejection. Otherwise entryAdd would better be implemented as a simpler
  // promise-returning function that does not involve the async function specifier.

  // Messages passed over a broadcast channel must be serializable, and should generally be small
  // because of high performance cost of serialization and deserialization. An entry object can be
  // considerably 'large' in that respect, so it is preferable to only pass a limited set of
  // properties. At the moment, I am only passing entry id.

  // For reference see the following url:
  // https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializeinternal

  if(channel) {
    const message = {type: 'entry-added', id: newEntryId};
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

    // TODO: now that filterUnprintableCharacters is a thing, I want to also filter such
    // characters from input strings like author/title/etc. However it overlaps with the
    // call to filterControls here. There is some redundant work going on. Also, in a sense,
    // filterControls is now inaccurate. What I want is one function that strips binary
    // characters except important ones, and then a second function that replaces or removes
    // certain important binary characters (e.g. remove line breaks from author string).
    // Something like 'replaceFormattingCharacters'.

    author = filterControls(author);
    author = replaceTags(author, '');
    author = condenseWhitespace(author);
    author = htmlTruncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  if(outputEntry.content) {
    let content = outputEntry.content;
    content = filterUnprintableCharacters(content);
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
