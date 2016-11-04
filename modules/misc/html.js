// See license.md

'use strict';

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
// TODO: maybe accept a whitelist of tags to keep
function replace_tags(input_str, rep_str) {
  if(typeof input_str !== 'string')
    throw new TypeError();

  let output_str = null;
  const doc = document.implementation.createHTMLDocument();
  const body_element = doc.body;
  body_element.innerHTML = input_str;

  if(rep_str) {
    const it = doc.createNodeIterator(body_element, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    const buffer = [];
    while(node) {
      buffer.push(node.nodeValue);
      node = it.nextNode();
    }

    output_str = buffer.join(rep_str);
  } else {
    output_str = body_element.textContent;
  }

  return output_str;
}

// Truncates a string containing some html, taking special care not to truncate
// in the midst of a tag or an html entity. The transformation is lossy as some
// entities are not re-encoded (e.g. &#32;).
// The input string should be encoded, meaning that it should contain character
// entity codes. The extension string should be decoded, meaning that it should
// not contain character entries.
// NOTE: using var due to deopt warning "unsupported phi use of const", c55
function truncate_html(input_str, position, input_ext) {
  if(typeof input_str !== 'string')
    throw new TypeError();
  if(!Number.isInteger(position) || position < 0)
    throw new TypeError();

  var ellipsis = '\u2026';
  var extension = input_ext || ellipsis;
  var inert_doc = document.implementation.createHTMLDocument();
  inert_doc.documentElement.innerHTML = input_str;
  var it = inert_doc.createNodeIterator(inert_doc.body, NodeFilter.SHOW_TEXT);
  let accepting_text = true;
  let total_len = 0;

  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(!accepting_text) {
      node.remove();
      continue;
    }

    // Accessing nodeValue yields a decoded string
    var value = node.nodeValue;
    var value_len = value.length;
    if(total_len + value_len >= position) {
      accepting_text = false;
      var remaining = position - total_len;
      // Setting nodeValue will implicitly encode the string
      node.nodeValue = value.substr(0, remaining) + extension;
    } else {
      total_len = total_len + value_len;
    }
  }

  // If the document was an html fragment then exclude the tags implicitly
  // inserted when setting innerHTML
  if(/<html/i.test(input_str))
    return inert_doc.documentElement.outerHTML;
  else
    return inert_doc.body.innerHTML;
}
