// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Truncates a string containing some html, taking special care not to truncate
// in the midst of a tag or an html entity. The transformation is lossy as some
// entities are not re-encoded (e.g. &#32;).
//
// The input string should be encoded, meaning that it should contain character
// entity codes. The extension string should be decoded, meaning that it should
// not contain character entries.
function truncate_html(input_str, position, input_ext) {
  console.assert(input_str);
  console.assert(position >= 0);

  const ELLIPSIS = '\u2026';
  const extension = input_ext || ELLIPSIS;

  const inert_doc = document.implementation.createHTMLDocument();
  inert_doc.documentElement.innerHTML = input_str;

  const it = inert_doc.createNodeIterator(inert_doc.body, NodeFilter.SHOW_TEXT);
  let accepting_text = true;
  let total_len = 0;

  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(!accepting_text) {
      node.remove();
      continue;
    }

    // Accessing nodeValue yields a decoded string
    let value = node.nodeValue;
    let value_len = value.length;
    if(total_len + value_len >= position) {
      accepting_text = false;
      let remaining = position - total_len;
      // Setting nodeValue will implicitly encode the string
      node.nodeValue = value.substr(0, remaining) + extension;
    } else {
      total_len = total_len + value_len;
    }
  }

  // If the document was an html fragment then exclude the tags implicitly
  // inserted when setting innerHTML
  if(/<html/i.test(input_str)) {
    return inert_doc.documentElement.outerHTML;
  } else {
    return inert_doc.body.innerHTML;
  }
}
