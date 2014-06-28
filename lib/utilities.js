/**
 * Misc. utilities. Basically a bunch of functions that
 * I do not yet consider to require separate modules or
 * be in separate files.
 */

'use strict';

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
 * Returns the first item in an array like object, or
 * undefined.
 */
util.first = function(obj) {
  if(obj && obj.length) {
    return obj[0];
  }
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


/**
 * Returns a string without certain binary characters
 *
 * TODO: this needs a better name
 * TODO: \t\r\n is approximately \s, and could just be \s
 * TODO: perf diff of \s/g and \s+/g  ?
 */
util.stripControls = function(str) {
  if(str) {
    return str.replace(/[\t\r\n]/g,'');
  }
};

/**
 * Returns truthy if str1 starts with str2, case sensitive
 */
util.startsWith = function(str1, str2) {
  return str1 && str1.lastIndexOf(str2, 0) == 0;
};

/**
 * Returns a string that has been shortened
 * NOTE: truncation is basically elision, truncate is
 * basically alias of elide
 */
util.truncate = function(str, pos, ext) {
  return str && (str.length > pos) ?
    str.substr(0,pos) + (ext || '...') :
    str;
};

/**
 * More accurately scrubs html from a string by
 * parsing it and then returning text nodes in order.
 *
 * NOTE: specifying replacement signicantly detracts perf
 */
util.stripTags = function(str, replacement) {
  if(str) {
    var doc = util.parseHTML(str);
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

/**
 * Simple regex approach to strip basic BR tags from string
 * This is not always accurate, just convenient.
 */
util.stripBRs = function(str) {
  if(str) {
    return str.replace(/<br>/gi,'');
  }
};

/**
 * HTML parsing that is as accurate as the user agent allows
 * by deferring to the native parsing method using
 * element.innerHTML = str.
 *
 * This does not use document.createElement. Webkit eagerly
 * fetches resources in the local document element even when
 * that element is never appended to the document. Therefore,
 * we instead create a foreign document, which implicitly
 * creates a DOM for us with a document element and a body
 * element. Then we use the innerHTML on the body element.
 *
 * Webkit distinguishes between local and foreign basically for
 * security purposes, which is why we have to jump through
 * hoops to use the native parser.
 *
 * Appending an element created in a foreign document to the
 * local document should technically throw an exception. The proper
 * approach is to use document.importNode or document.adoptNode
 * to create an element within the local document context and
 * then append that element. However, Chrome sometimes allows for
 * the import step to be implied when using appendChild or
 * replaceChild where the parent has citizenship and the child is
 * alien. Caveat implementor.
 *
 * NOTE: DOMParser.parseFromString in webkit looks
 * like it just calls implementation.createDocument and then calls
 * internal method setContent(str). The two approaches
 * are basically the same.
 */
util.parseHTML= function(str) {
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;
  return doc.body;
};

/**
 * See http://www.html5rocks.com/en/tutorials/webcomponents/template/
 * This might solve several problems. It is inert until appended. It still
 * uses what is basically the innerHTML hack. It gives us something
 * rootless so we do not have to mess with doc.body stuff. It also
 * significantly less heavyweight then creating a document. It looks
 * like it also requires adoptNode instead of doing it implicitly in
 * appendChild.
 */
util.parseHTML2DevTest = function(str) {
  var template = document.createElement('template');
  template.content = str;
  return template;
};


/**
 * Parses the XML. If the XML is invalid, an exception is thrown
 */
util.parseXML = function(str) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(str, 'application/xml');

  if(!doc) {
    throw new Error('parse xml failed to produce an XML document');
  }

  // I am really struggling to understand why the spec
  // designers thought this would be a good idea. This
  // function exists only because of this junk.
  var e = doc.getElementsByTagName('parsererror');
  if(e && e.length) {
    e = e[0];
    if(e.firstChild && e.firstChild.nextSibling) {
      e = e.firstChild.nextSibling.textContent;
      if(e) {
        throw e;
      }
    }
    throw e.textContent;
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

  // property duration function delay
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
 * Elements are matched in selector order, then in document order. For
 * a match to occur the element must match the selector AND the value
 * must be non-empty. It is entirely possible that an element matches
 * the selector, but if it yields an empty value, the search continues.
 * If iterate ends without a match then undefined is returned.
 */
util.findText = function(rootElement, selectors, attribute) {

  // TODO: nothing in the native array iteration API fits
  // TODO: getElementAttributeValue accesses attribute from its
  // outer scope. It would be better to define it once
  // outside of this function and then use a partial. Or just make
  // getElementText a required argument instead of the optional
  // attribute argument. Make the caller define the method because
  // that is invariant to this entire function.

  var getElementText = attribute ? function getElementAttributeValue(element) {
    return element.getAttribute(attribute);
  } : util.getElementTextContent;

  for(var i = 0, len = selectors.length, temp; i < len;i++) {
    temp = rootElement.querySelector(selectors[i]);
    if(!temp) continue;
    temp = getElementText(temp);
    if(!temp) continue;
    temp = temp.trim();
    if(!temp) continue;
    return temp;
  }
};

/**
 * A getter function for accessing element.textContent
 */
util.getElementTextContent = function(element) {
  return element.textContent;
};

/**
 * Finds first matching CSS rule by selectorText query.
 */
util.findCSSRule = function(sheet, selectorText) {

  var rules = sheet ? sheet.cssRules : undefined;

  // TODO: use a partial, something like
  // var partial = util.cssRuleMatches.bind(selectorText);
  // return util.first(util.filter(partial));

  return this.first(this.filter(rules, function(rule) {
    return rule.selectorText == selectorText;
  }));
};