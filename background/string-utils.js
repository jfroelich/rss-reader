// String utilities
(function(exports) {
'use strict';

exports.startsWith = function(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
};

// Truncates a string
// ext is optional override of default ellipsis replacement
exports.truncate = function(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
};


function getEntityCode(entityCharacter) {
  return '&#' + entityCharacter.charCodeAt(0) + ';';
}

// & not being escaped at the moment, intentionally
exports.escapeHTML = function(str) {
  if(str) {
    return str.replace(/[<>"”'`]/g, getEntityCode);
  }
};

exports.escapeHTMLAttribute = function(str) {
  if(str) {
    return str.replace('&','&#38;').replace('"','&#34;').
      replace('\'','&#39;').replace('\\','&#92;');
  }
};

exports.escapeHTMLInputValue = function(str) {
  if(str)
    return str.replace('"', '&#34;');
};

exports.escapeHTMLHREF = function(str) {
  if(str)
    return str.replace('"', '&#34;');
};


/**
 * Strip HTML tags from a string
 * Replacement is an optional parameter, string, that is included
 * in the place of tags.
 * Specifying a replacement works considerably slower for
 * large documents.
 * Requires parseHTML, document.createNodeIterator
 */
exports.stripTags = function(str, replacement) {
  if(str) {
    var doc = parseHTML(str);
    
    if(replacement) {
      // Filter the text nodes into an array and join its items 
      // using replacement
      var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT),
        node, textNodes = [];

      while(node = it.nextNode()) {
        textNodes.push(node.data);
      }
      
      return textNodes.join(replacement);
    } else {
      // Let the browser do the work
      return doc.body.textContent;  
    }
  }
};

/**
 * An extremely basic tag stripping function. This is not 
 * intended to work perfectly, just good enough for a 
 * few basic situations. Use the html parser for 
 * accurate tag handling.
 */
var MATCH_TAG = /<.*>/g;
exports.stripTagsFast = function(str) {
  if(str) {
    return str.replace(MATCH_TAG, '');
  }
};


}(this));