/**
 * TODO: each, filter, until, any all deprecated, all callers must use
 * native methods instead
 *
 * Snippet note:
 * each = Function.prototype.call.bind(Array.prototype.forEach),
 * filter = Function.prototype.call.bind(Array.prototype.filter),
 */

var utils = {
  noop: function(){},
  setIfDefined: function(obj, key, value) {
    if(value) {
      obj[key] = value;
    }
  }
};

var arrays = {

  eachR: function(obj, func) {
    var i = obj.length;
    while(i--) {
      func(obj[i]);
    }
  },
  toArray: function(obj) {
    return Array.prototype.slice.call(obj);
  },
  values: function(obj) {
    return Object.keys(obj).filter(hop).map(valAtKey);
    function hop(key) { return Object.prototype.hasOwnProperty.call(obj, key); }
    function valAtKey(key) { return obj[key]; }
  },
  maxNumber: function(arr) {
    // Adapted from http://stackoverflow.com/questions/11190407
    return (arr || []).reduce(function(max, currentValue) {
      return Math.max(max, currentValue);
    }, -Infinity);
  }
};

/**
 * Very naive and basic date utilities
 */
var dates = {
  format: function(date, sep) {
    return date?
      [date.getMonth() + 1, date.getDate(), date.getFullYear()].join(sep || '-') :
      '';
  },
  parse: function(str) {
    if(!str) {
      return;
    }

    var date = new Date(str);

    if(Object.prototype.toString.call(date) != '[object Date]') {
      return;
    }

    if(!isFinite(date)) {
      return;
    }

    return date;
  }
};

var strings = {
  stripControls: function(str) {
    if(str) {
      return str.replace(/[\t\r\n]/g,'');
    }
  },
  startsWith: function(str1, str2) {
    return str1 && str1.lastIndexOf(str2, 0) == 0;
  },
  truncate: function(str, pos, ext) {
    return str && (str.length > pos) ?
      str.substr(0,pos) + (ext || '...') :
      str;
  },
  /**
   * similar to str.replace
   */
  stripTags: function(str, replacement) {
    if(str) {
      var doc = strings.parseHTML(str);
      if(replacement) {
        var it = doc.createNodeIterator(doc, NodeFilter.SHOW_TEXT),
          node, textNodes = [];
        while(node = it.nextNode()) {
          textNodes.push(node.data);
        }

        return textNodes.join(replacement);
      }

      return doc.textContent;
    }
  },
  stripBRs: function(str) {
    if(str) {
      return str.replace(/<br>/gi,'');
    }
  },
  parseHTML: function(str) {
    // NOTE: do not use createElement because it eagerly fetches
    var doc = document.implementation.createHTMLDocument();
    doc.body.innerHTML = str;

    // TODO: experiment with doc.documentElement.innerHTML

    // TODO: would frag be more appropriate?
    // var frag = doc.createDocumentFragment();
    // while(doc.body.firstChild) {
      // frag.appendChild(doc.body.firstChild);
    //};
    // return frag;

    return doc.body;
  },
  parseXML: function(str) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(str, 'application/xml');

    var sigh = doc ? doc.getElementsByTagName('parsererror') : doc;
    if(sigh && sigh[0]) {
      sigh = sigh[0];
      if(sigh.firstChild && sigh.firstChild.nextSibling) {
        sigh = sigh.firstChild.nextSibling.textContent;
        if(sigh) {
          throw sigh;
        }
      }
      throw sigh.textContent;
    }

    return doc;
  }
};