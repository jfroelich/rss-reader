// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class StringUtils {

  static removeTags(string, replacement) {
    if(string) {
      const doc = document.implementation.createHTMLDocument();
      doc.body.innerHTML = string;
      if(!replacement) {
        return doc.body.textContent;
      }
      const iterator = doc.createNodeIterator(
        doc.body, NodeFilter.SHOW_TEXT);
      let node = iterator.nextNode();
      const values = [];
      while(node) {
        values.push(node.nodeValue);
        node = iterator.nextNode();
      }
      return values.join(replacement);
    }
  }

  // TODO: research the proper pattern
  // /[^\x20-\x7E]+/g;
  static stripControlCharacters(string) {
    const RE_CONTROL_CHARACTER = /[\t\r\n]/g;
    if(string) {
      return string.replace(RE_CONTROL_CHARACTER,'');
    }
  }

  static truncate(string, position, extension) {
    if(string && string.length > position) {
      const ELLIPSIS = '\u2026';
      extension = extension || ELLIPSIS;
      return string.substr(0, position) + extension;
    }
    return string;
  }
}
