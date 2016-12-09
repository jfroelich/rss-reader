// See license.md

'use strict';

class HTMLUtils {

  // Returns a new string where html elements were replaced with the optional
  // replacement string. HTML entities remain (except some will be
  // replaced, like &#32; with space).
  static replaceTags(inputString, repString) {
    let outputString = null;
    const doc = document.implementation.createHTMLDocument();
    const body = doc.body;
    body.innerHTML = inputString;

    if(repString) {
      const it = doc.createNodeIterator(body, NodeFilter.SHOW_TEXT);
      let node = it.nextNode();
      const buffer = [];
      while(node) {
        buffer.push(node.nodeValue);
        node = it.nextNode();
      }

      outputString = buffer.join(repString);
    } else {
      outputString = body.textContent;
    }

    return outputString;
  }

  // Truncates a string containing some html, taking special care not to
  // truncate in the midst of a tag or an html entity. The transformation is
  // lossy as some entities are not re-encoded (e.g. &#32;).
  // The input string should be encoded, meaning that it should contain
  // character entity codes. The extension string should be decoded, meaning
  // that it should not contain character entries.
  //
  // Using var due to deopt warning "unsupported phi use of const", c55
  static truncate(inputString, position, extensionString) {

    if(!Number.isInteger(position) || position < 0)
      throw new TypeError();

    var ellipsis = '\u2026';
    var extension = extensionString || ellipsis;
    var doc = document.implementation.createHTMLDocument();
    doc.documentElement.innerHTML = inputString;
    var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
    let acceptingText = true;
    let totalLength = 0;

    for(let node = it.nextNode(); node; node = it.nextNode()) {
      if(!acceptingText) {
        node.remove();
        continue;
      }

      // Accessing nodeValue yields a decoded string
      var value = node.nodeValue;
      var valueLength = value.length;
      if(totalLength + valueLength >= position) {
        acceptingText = false;
        var remaining = position - totalLength;
        // Setting nodeValue will implicitly encode the string
        node.nodeValue = value.substr(0, remaining) + extension;
      } else {
        totalLength = totalLength + valueLength;
      }
    }

    // If the document was an html fragment then exclude the tags implicitly
    // inserted when setting innerHTML
    if(/<html/i.test(inputString))
      return doc.documentElement.outerHTML;
    else
      return doc.body.innerHTML;
  }
}
