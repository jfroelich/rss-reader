// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

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
