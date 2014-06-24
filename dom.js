/**
 * Alias for querySelector
 */
function $(selector,doc) {
  return (doc || document).querySelector(selector);
}

/**
 * Alias for querySelectorAll
 */
function $$(selector,doc) {
  return (doc || document).querySelectorAll(selector);
}

/**
 * event.keyCode enum for key codes of interest
 */
var KEY = {
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  N: 78,
  P: 80
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
function smoothScrollToY(element, delta, targetY) {
  var scrollYStartTimer;
  var scrollYIntervalTimer;
  var amountToScroll = 0;
  var amountScrolled = 0;

  return export();

  function export() {
    clearTimeout(scrollYStartTimer);
    clearInterval(scrollYIntervalTimer);
    scrollYStartTimer = setTimeout(start,5);
  }

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
}

/**
 * Fade an element in/out
 * Elements must have opacity defined as 0 or 1 for this to work
 *
 * TODO: this needs to be entirely refactored. it could be
 * greatly simplified, it could make fewer assumptions about the element's
 * state
 */
function fadeElement(element, duration, delay, callback) {

  if(element.style.display == 'none') {
    element.style.display = '';
    element.style.opacity = '0';
  }

  if(!element.style.opacity) {
    element.style.opacity = element.style.display == 'none' ? '0' : '1';
  }

  if(callback) {
    element.addEventListener('webkitTransitionEnd', webkitTransitionEndEventListener);
  }

  // element duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity == '1' ? '0' : '1';

  function webkitTransitionEndEventListener(event) {
    this.removeEventListener('webkitTransitionEnd', webkitTransitionEndEventListener);
    callback(element);
  }
}

/**
 * Gets the textContent of a specific element or the value of a specific
 * attribute in the element. Works for both XML and HTML. The value of
 * the attribute is used if the attribute is specified.
 *
 * Elements are matched in selector order, then in document order.
 */
function findText(element, selectors, attribute) {

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
}

/**
 * For finding a CSS rule in a stylesheet by its matching CSS text.
 *
 * NOTE: this only searches one sheet. Currently this only searches
 * the first sheet. Currently this throws an error if there are no
 * sheets.
 *
 * TODO: sheet could be a parameter to this so it does not ave to
 * make the assumption about which sheet to search
 */
function findCSSRule(selectorText) {
  var matchingRule;

  // We are always using styleSheets[0], so we can cheat here
  var sheet = document.styleSheets[0];

  // TODO: there must be some type of more appropriate
  // iterator for this objective. Something like
  // Array.prototype.some, but used with an intentional
  // side effect.

  until(sheet.rules, function(rule) {
    if(rule.selectorText == selectorText) {
      matchingRule = rule;
      return false;
    }
    return true;
  });
  return matchingRule;
}