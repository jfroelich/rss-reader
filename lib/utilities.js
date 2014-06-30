

// No operation 'singleton'
function noop() {
}

// Gets the values of the properties of an array-like object
// TODO: this is a good use case to learn about partials
function objectValues(obj) {
  return Object.keys(obj).filter(function(key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }).map(function(key) {
    return obj[key];
  });
}


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
    element.addEventListener('webkitTransitionEnd', ended);
  }

  // property duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity == '1' ? '0' : '1';

  function ended(event) {
    this.removeEventListener('webkitTransitionEnd', ended);
    callback(element);
  }
}