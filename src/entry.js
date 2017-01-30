// See license.md

'use strict';

class Entry {

  // Get the last url in an entry's internal url list
  static getURL(entry) {
    if(!entry.urls.length)
      throw new TypeError();
    return entry.urls[entry.urls.length - 1];
  }

  static addURL(entry, urlString) {
    if(!entry.urls)
      entry.urls = [];
    const normalized_url = new URL(urlString);
    if(entry.urls.includes(normalized_url.href))
      return false;
    entry.urls.push(normalized_url.href);
    return true;
  }

  // Returns a new entry object where fields have been sanitized. Impure
  // TODO: ensure dates are not in the future, and not too old? Should this be
  // a separate function like validate_entry
  static sanitize(inputEntry) {
    const authorMaxLen = 200;
    const titleMaxLen = 1000;
    const contentMaxLen = 50000;
    const outputEntry = Object.assign({}, inputEntry);

    if(outputEntry.author) {
      let author = outputEntry.author;
      author = StringUtils.filterControlChars(author);
      author = HTMLUtils.replaceTags(author, '');
      author = StringUtils.condenseWhitespace(author);
      author = HTMLUtils.truncate(author, authorMaxLen);
      outputEntry.author = author;
    }

    // Condensing node whitespace is handled separately
    // TODO: filter out non-printable characters other than \r\n\t
    if(outputEntry.content) {
      let content = outputEntry.content;
      content = HTMLUtils.truncate(content, contentMaxLen);
      outputEntry.content = content;
    }

    if(outputEntry.title) {
      let title = outputEntry.title;
      title = StringUtils.filterControlChars(title);
      title = HTMLUtils.replaceTags(title, '');
      title = StringUtils.condenseWhitespace(title);
      title = HTMLUtils.truncate(title, titleMaxLen);
      outputEntry.title = title;
    }

    return outputEntry;
  }
}

Entry.UNREAD = 0;
Entry.READ = 1;
Entry.UNARCHIVED = 0;
Entry.ARCHIVED = 1;
