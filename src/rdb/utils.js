import * as Entry from "/src/rdb/entry.js";
import * as Feed from "/src/rdb/feed.js";
import {replaceTags, truncateHTML} from "/src/common/html-utils.js";

// Returns a shallow copy of the input feed with sanitized properties
export function sanitizeFeed(feed, titleMaxLength, descMaxLength) {
  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1024;
  }

  if(typeof descMaxLength === 'undefined') {
    descMaxLength = 1024 * 10;
  }

  const blankFeed = Feed.create();
  const outputFeed = Object.assign(blankFeed, feed);
  const tagReplacement = '';
  const suffix = '';

  if(outputFeed.title) {
    let title = outputFeed.title;
    title = filterControls(title);
    title = replaceTags(title, tagReplacement);
    title = condenseWhitespace(title);
    title = truncateHTML(title, titleMaxLength, suffix);
    outputFeed.title = title;
  }

  if(outputFeed.description) {
    let desc = outputFeed.description;
    desc = filterControls(desc);
    desc = replaceTags(desc, tagReplacement);
    desc = condenseWhitespace(desc);
    desc = truncateHTML(desc, descMaxLength, suffix);
    outputFeed.description = desc;
  }

  return outputFeed;
}



// Inspect the entry object and throw an error if any value is invalid
// or any required properties are missing
export function validateEntry(entry) {
  // TODO: implement
  // By not throwing an error, this indicates the entry is valid
}

// Returns a new entry object where fields have been sanitized. Impure
// TODO: now that filterUnprintableCharacters is a thing, I want to also filter such
// characters from input strings like author/title/etc. However it overlaps with the
// call to filterControls here. There is some redundant work going on. Also, in a sense,
// filterControls is now inaccurate. What I want is one function that strips binary
// characters except important ones, and then a second function that replaces or removes
// certain important binary characters (e.g. remove line breaks from author string).
// Something like 'replaceFormattingCharacters'.
export function sanitizeEntry(inputEntry, authorMaxLength, titleMaxLength, contentMaxLength) {

  if(typeof authorMaxLength === 'undefined') {
    authorMaxLength = 200;
  }

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1000;
  }

  if(typeof contentMaxLength === 'undefined') {
    contentMaxLength = 50000;
  }

  const blankEntry = Entry.createEntry();
  const outputEntry = Object.assign(blankEntry, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = filterControls(author);
    author = replaceTags(author, '');
    author = condenseWhitespace(author);
    author = truncateHTML(author, authorMaxLength);
    outputEntry.author = author;
  }

  if(outputEntry.content) {
    let content = outputEntry.content;
    content = filterUnprintableCharacters(content);
    content = truncateHTML(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControls(title);
    title = replaceTags(title, '');
    title = condenseWhitespace(title);
    title = truncateHTML(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}

function condenseWhitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

// Returns a new object that is a copy of the input less empty properties. A property is empty if it
// is null, undefined, or an empty string. Ignores prototype, deep objects, getters, etc. Shallow
// copy by reference.
export function filterEmptyProps(object) {
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const output = {};
  let undef;
  if(typeof object === 'object' && object !== null) {
    for(const key in object) {
      if(hasOwnProp.call(object, key)) {
        const value = object[key];
        if(value !== undef && value !== null && value !== '') {
          output[key] = value;
        }
      }
    }
  }

  return output;
}

// If the input is a string then the function returns a new string that is approximately a copy of
// the input less certain 'unprintable' characters. In the case of bad input the input itself is
// returned. To test if characters were replaced, check if the output string length is less than the
// input string length.
// Basically this removes those characters in the range of [0..31] except for the following four
// characters:
// \t is \u0009 which is base10 9
// \n is \u000a which is base10 10
// \f is \u000c which is base10 12
// \r is \u000d which is base10 13
// TODO: look into how much this overlaps with filterControls

const unprintablePattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;
export function filterUnprintableCharacters(value) {
  // The length check is done because given that replace will be a no-op when the length is 0 it is
  // faster to perform the length check than it is to call replace. I do not know the distribution
  // of inputs but I expect that empty strings are not rare.
  return typeof value === 'string' && value.length ? value.replace(unprintablePattern, '') : value;
}

// Returns a new string where Unicode Cc-class characters have been removed. Throws an error if
// string is not a defined string. Adapted from these stack overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
export function filterControls(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}
