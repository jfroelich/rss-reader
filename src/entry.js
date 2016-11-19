// See license.md

'use strict';

class Entry {

  // Get the last url in an entry's internal url list
  static getURL(entry) {
    if(!entry.urls.length)
      throw new TypeError();
    return entry.urls[entry.urls.length - 1];
  }

  static addURL(entry, url_str) {
    if(!entry.urls)
      entry.urls = [];
    const normalized_url = new URL(url_str);
    if(entry.urls.includes(normalized_url.href))
      return false;
    entry.urls.push(normalized_url.href);
    return true;
  }

  // Returns a new entry object where fields have been sanitized. Impure
  // TODO: ensure dates are not in the future, and not too old? Should this be
  // a separate function like validate_entry
  static sanitize(input_entry) {
    const author_max_len = 200;
    const title_max_len = 1000;
    const content_max_len = 50000;
    const output_entry = Object.assign({}, input_entry);

    if(output_entry.author) {
      let author = output_entry.author;
      author = StringUtils.filterControlChars(author);
      author = replace_tags(author, '');
      author = StringUtils.condenseWhitespace(author);
      author = truncate_html(author, author_max_len);
      output_entry.author = author;
    }

    // Condensing node whitespace is handled separately
    // TODO: filter out non-printable characters other than \r\n\t
    if(output_entry.content) {
      let content = output_entry.content;
      content = truncate_html(content, content_max_len);
      output_entry.content = content;
    }

    if(output_entry.title) {
      let title = output_entry.title;
      title = StringUtils.filterControlChars(title);
      title = replace_tags(title, '');
      title = StringUtils.condenseWhitespace(title);
      title = truncate_html(title, title_max_len);
      output_entry.title = title;
    }

    return output_entry;
  }

}

Entry.UNREAD = 0;
Entry.READ = 1;
Entry.UNARCHIVED = 0;
Entry.ARCHIVED = 1;
