
var strings = {};

// Returns true if str1 starts with str2
strings.startsWith = function(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
};

// Truncates a string
// ext is optional override of default ellipsis replacement
strings.truncate = function(str, pos, ext) {
  return str && (str.length > pos) ? str.substr(0,pos) + (ext || '...') : str;
};

strings.getEntityCode_ = function(entityCharacter) {
  return '&#' + entityCharacter.charCodeAt(0) + ';';
}

// & not being escaped at the moment, intentionally
strings.escapeHTML = function(str) {
  if(str) {
    return str.replace(/[<>"”'`]/g, this.getEntityCode_);
  }
};

strings.escapeHTMLAttribute = function(str) {
  if(str) {
    return str.replace('&','&#38;').replace('"','&#34;').
      replace('\'','&#39;').replace('\\','&#92;');
  }
};

strings.escapeHTMLInputValue = function(str) {
  if(str) {
    return str.replace('"', '&#34;');
  }
};

strings.escapeHTMLHREF = function(str) {
  if(str) {
    return str.replace('"', '&#34;');
  }
};


/**
 * Strip HTML tags from a string
 * Replacement is an optional parameter, string, that is included
 * in the place of tags.
 * Specifying a replacement works considerably slower
 */
strings.stripTags = function(str, replacement) {
  if(str) {
    var doc = htmlParser.parse(str);

    if(replacement) {
      var it = doc.createNodeIterator(doc, NodeFilter.SHOW_TEXT),
        node, textNodes = [];
      while(node = it.nextNode()) {
        textNodes.push(node.data);
      }
      
      return textNodes.join(replacement);
    }

    // Let the browser do the work
    return doc.textContent;
  }
};

// An extremely basic tag stripping function.
// Not intended to be perfect.
strings.MATCH_TAG_ = /<.*>/g;
strings.stripTagsFast = function(str) {
  if(str) {
    return str.replace(this.MATCH_TAG_, '');
  }
};