/**
 * Misc. utilities. Basically a bunch of functions that
 * I do not yet consider to require separate modules or
 * in separate files.
 */

/**
 * Global alias for querySelector
 */
function $(selector,doc) {
  return (doc || document).querySelector(selector);
}

/**
 * Global alias for querySelectorAll
 */
function $$(selector,doc) {
  return (doc || document).querySelectorAll(selector);
}


var util = {};

/**
 * A function that just returns the first value
 * passed to it.
 */
util.identity = function(value) {
  return value;
};

/**
 * Returns the first value of an array or array
 * like object.
 * NOTE: index out of bounds attempt is just undefined?
 */
util.first = function(arr) {
  if(arr) {
    return arr[0];
  }
};

/**
 * A function that does nothing, similar to
 * a singleton.
 */
util.noop = function() {};

/**
 * Sets a the property of an object to the value but
 * only if the value is truthy. Useful to avoid setting
 * properties where the value is falsy (undefined/empty string/etc),
 * because sometimes whether a property exists is just as important
 * as whether it has a value.
 */
util.setIfDefined = function(obj, key, value) {
  if(value) {
    obj[key] = value;
  }
};

/**
 * Array.prototype.filter for array-like objects
 * NOTE: each = Function.prototype.call.bind(Array.prototype.forEach),
 * TODO: allow for thisArg
 */
util.each = function(obj, callback) {
  return Array.prototype.forEach.call(obj, callback);
};

/**
 * Array.prototype.filter for array-like objects.
 * NOTE: filter = Function.prototype.call.bind(Array.prototype.filter)
 * TODO: allow for thisArg
 */
util.filter = function(obj, callback) {
  return Array.prototype.filter.call(obj, callback);
};

/**
 * Reverse each
 * TODO: allow for thisArg (use func.call?)
 */
util.eachr = function(obj, callback) {
  var i = obj ? obj.length : 0;
  while(i--) {
    func(obj[i]);
  }
};

/**
 * Simple way of converting array-like obj to
 * an array. similar to cloning an array but
 * for array like objects as the domain and
 * an array as the range.
 */
util.toArray = function(obj) {
  return Array.prototype.slice.call(obj);
};

/**
 * Tests whether obj has the prop. Props can
 * be on the object itself or inherited. Sometimes we want
 * to look at the obj itself and not consider ancestry.
 */
util.has = function(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
};

/**
 * Gets the values of the properties of an array-like
 * object.
 */
util.values = function(obj) {

  // Object.getOwnPropertyNames includes non-enumerable
  // so cannot use it. Object.keys includes properties
  // from the prototype chain so it must be filtered
  // by hasOwnProperty

  // TODO: this is a good use case to learn about partials,
  // the code would look something like this:
  // var has = util.has.bind(obj), val = util.at.bind(obj);
  // return Object.keys(obj).filter(has).map(val);

  return Object.keys(obj).filter(function(key) {
    return util.has(obj, key);
  }).map(function(key) {
    return obj[key];
  });
};

/**
 * Find the max number in array of numbers.
 * Adapted from http://stackoverflow.com/questions/11190407
 * TODO: figure out how to just pass Math.max to reduce
 * TODO: generalize to any type by passing in a sort predicate?
 */
util.maxNumber = function(arr) {
  // Uses -Infinity instead of 0 as the initialValue to allow for
  // negatives.
  return (arr || []).reduce(function(max, currentValue) {
    return Math.max(max, currentValue);
  }, -Infinity);
};

/**
 * Very naive formatting. Basically a placeholder until
 * something like moments.js is integrated.
 */
util.formatDate = function(date, sep) {
  return date ? [date.getMonth() + 1, date.getDate(),
    date.getFullYear()].join(sep || '-') : '';
};

/**
 * Somewhat naive date parsing.
 */
util.parseDate = function(str) {
  if(!str) {
    return;
  }

  var date = new Date(str);

  // Try to avoid returning an invalid date

  if(Object.prototype.toString.call(date) != '[object Date]') {
    return;
  }

  if(!isFinite(date)) {
    return;
  }

  return date;
};


util.stripControls = function(str) {
  if(str) {
    return str.replace(/[\t\r\n]/g,'');
  }
};

util.startsWith = function(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
};

util.truncate = function(str, pos, ext) {
  return str && (str.length > pos) ?
    str.substr(0,pos) + (ext || '...') :
    str;
};

util.stripTags = function(str, replacement) {
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
};

util.stripBRs = function(str) {
  if(str) {
    return str.replace(/<br>/gi,'');
  }
};


util.parseHTML= function(str) {
  // NOTE: do not use createElement because it eagerly fetches
  var doc = document.implementation.createHTMLDocument();

  // TODO: use doc.documentElement.innerHTML instead?

  doc.body.innerHTML = str;

  // TODO: would frag be more appropriate?
  // var frag = doc.createDocumentFragment();
  // while(doc.body.firstChild) {
    // frag.appendChild(doc.body.firstChild);
  //};
  // return frag;

  return doc.body;
};

/**
 * I prefer parsing exceptions to be thrown
 */
util.parseXML = function(str) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(str, 'application/xml');

  var perror = doc ? doc.getElementsByTagName('parsererror') : doc;
  if(perror && perror[0]) {
    perror = perror[0];
    if(perror.firstChild && perror.firstChild.nextSibling) {
      perror = perror.firstChild.nextSibling.textContent;
      if(perror) {
        throw perror;
      }
    }
    throw perror.textContent;
  }

  return doc;
};


/**
 * Periodically scroll from the current position to a new position
 *
 * NOTE: the start timer is basically to debounce calls to this function
 * whereas the interval timer is to track the interval and stop it when
 * finished
 *
 * @param element {Element} the element to scroll
 * @param delta {int} the amount of pixels by which to scroll per increment
 * @param targetY {int} the desired vertical end position
 */
util.smoothScrollToY = function(element, delta, targetY) {
  var scrollYStartTimer;
  var scrollYIntervalTimer;
  var amountToScroll = 0;
  var amountScrolled = 0;

  return function export() {
    clearTimeout(scrollYStartTimer);
    clearInterval(scrollYIntervalTimer);
    scrollYStartTimer = setTimeout(start,5);
  }();

  function start() {
    amountToScroll = Math.abs(targetY - element.scrollTop);
    amountScrolled = 0;

    if(amountToScroll == 0) {
      return;
    }

    scrollYIntervalTimer = setInterval(scrollToY,20);
  }

  function scrollToY() {
    var currentY = element.scrollTop;
    element.scrollTop += delta;
    amountScrolled += Math.abs(delta);

    // If there was no change or we scrolled too far, then we are done.
    if(currentY == element.scrollTop || amountScrolled >= amountToScroll) {
      clearInterval(scrollYIntervalTimer);
    }
  }
};

/**
 * Fade an element in/out
 * Elements must have opacity defined as 0 or 1 for this to work
 *
 * TODO: this needs to be entirely refactored. it could be
 * greatly simplified, it could make fewer assumptions about the element's
 * state
 */
util.fadeElement = (element, duration, delay, callback) {

  if(element.style.display == 'none') {
    element.style.display = '';
    element.style.opacity = '0';
  }

  if(!element.style.opacity) {
    element.style.opacity = element.style.display == 'none' ? '0' : '1';
  }

  if(callback) {
    element.addEventListener('webkitTransitionEnd', ended);
  }

  // element duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity == '1' ? '0' : '1';

  function ended(event) {
    this.removeEventListener('webkitTransitionEnd', ended);
    callback(element);
  }
};

/**
 * Gets the textContent of a specific element or the value of a specific
 * attribute in the element. Works for both XML and HTML. The value of
 * the attribute is used if the attribute is specified.
 *
 * Elements are matched in selector order, then in document order.
 */
util.findText = function(element, selectors, attribute) {

  var result;

  selectors.some(function(selector) {
    var text;
    var node = element.querySelector(selector);
    if(node) {
      text = attribute ? node.getAttribute(attribute) : node.textContent;
      text = (text || '').trim();
      if(text) {
        result = text;
        return true;
      }
    }
  });

  return result;
};

/**
 * Finds first matching CSS rule by selectorText query.
 *
 * TODO: the reduce callback still needs work. I don't like
 * how it ends up getting called multiple times when there
 * are multiple matches. We want some function that just
 * operates on the first element of an array. Something
 * like util.first = function(arr) { return arr[0]};
 * underscore has this as well...aliased as first/head/take
 *
 * NOTE: sheet is no longer set to document.styleSheets[0] and is
 * now a parameter, callers need to be revised.
 */
util.findCSSRule = function(sheet, selectorText) {
  return Array.prototype.filter.call(sheet.cssRules, function(rule) {
    return rule.selectorText == selectorText;
  }).reduce(function(previousValue, currentValue) {
    return previousValue ? previousValue : currentValue;
  });
};