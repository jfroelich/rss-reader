// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: I plan to deprecate the Entry object because it is anemic. The only
// exports here will be the flags and some entry related functions. I also
// plan to avoid serialization. This means urls will all be strings.

// Given an entry object, return the last url in its internal url chain.
// The returned url will be a URL object for now, but in the future, once I
// stop serialization, the returned url will be a string.
// This function assumes that entry.urls is always a defined array with at
// least one value. In general, an entry shouldn't exist without a url, or the
// caller should never be calling this function at that point. It is the
// caller's responsibility to ensure the presence of a url.
function get_entry_terminal_url(entry) {
  console.assert(entry);
  console.assert(entry.urls);
  console.assert(entry.urls.length);
  return entry.urls[entry.urls.length - 1];
}

// Note: untested, under dev. The input this time is a string, and entry.urls
// should contain strings. Part of a series of changes i am making with plan
// to avoid having to deserialize and reserialize entries
// Returns true if the url was added.
function append_entry_url(entry, url_string) {
  console.assert(entry);
  console.assert(url_string);

  // Lazily create the urls property. This is not the caller's responsibility
  // because it means less boilerplate.
  if(!('urls' in entry)) {
    entry.urls = [];
  }

  // In order to compare the url to existing urls, we need to convert the url
  // to a URL object. This should never throw. It is the caller's responsibility
  // to provide a valid url.
  const url_obj = new URL(url_string);

  // To normalize a value means that a given value could have many valid
  // realizations, and that given any one of these realizations, to change the
  // value into a canonical, standard, preferred form. For example, the value
  // could be uppercase, or mixed case, or lowercase. The preferred form is
  // lowercase. So normalizing the value means lower casing it.

  // Apply additional url normalizations. Delete the hash
  // It's possible this should be a function call like normalize_url(url).
  // Deleting the hash is not really a normalization in the basic sense of
  // dealing with varied string representations. Here I am removing the hash
  // because I want to consider a url with a hash and without, which is
  // otherwise the same url, as the same url.
  url_obj.hash = '';

  // Now get a normalized url. The process of converting to a url object and
  // back to a string is what caused the normalization. This built in process
  // does several things, like remove default ports, lowercase hostname,
  // lowercase protocol, etc.
  // Note that .href is synonymous with toString()
  const normalized_url_str = url_obj.href;

  // Check that the url does not already exist. entry.urls only contains
  // normalized url strings because only normalized urls are added
  for(let entry_url_str of entry.urls) {
    if(entry_url_str === normalized_url_str) {
      return false;
    }
  }

  entry.urls.push(normalized_url_str);
  return true;
}



// Corresponds to an deserialized entry database object.
function Entry() {
  this.archiveState = Entry.FLAGS.UNARCHIVED;
  this.author = null;
  this.content = null;
  this.dateArchived = null;
  this.dateCreated = null;
  this.datePublished = null;
  this.dateRead = null;
  this.enclosure = null;
  this.faviconURLString = null;
  this.feedTitle = null;
  this.feed = null;
  this.id = null;
  this.readState = Entry.FLAGS.UNREAD;
  this.title = null;
  this.urls = null;
}

Entry.FLAGS = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};

// TODO: expect url objects only
Entry.prototype.add_url = function(url) {

  if(!this.urls) {
    this.urls = [];
  }

  if(Object.prototype.toString.call(url) === '[object URL]') {

    if(this.urls.length) {
      if(Object.prototype.toString.call(this.urls[0]) === '[object URL]') {

        // cannot use includes because URL object equality is funky
        for(let urlObject of this.urls) {
          if(urlObject.href === url.href) {
            return;
          }
        }
      } else {
        for(let urlString of this.urls) {
          if(urlString === url.href) {
            return;
          }
        }
      }
    }

    this.urls.push(url);
  } else {
    if(this.urls.length) {
      if(Object.prototype.toString.call(this.urls[0]) === '[object URL]') {
        for(let urlObject of this.urls) {
          if(urlObject.href === url) {
            return;
          }
        }

      } else {
        if(this.urls.includes(url)) {
          return;
        }
      }

      this.urls.push(url);
    }
  }
};

Entry.prototype.get_url = function() {
  if(Entry.prototype.has_url.call(this)) {
    return this.urls[this.urls.length - 1];
  }
};

Entry.prototype.has_url = function() {
  return this.urls && this.urls.length;
};
