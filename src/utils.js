// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Detatches an element from the dom
function removeElement(element) {
  'use strict';
  element.remove();
}

// NOTE: not optimized for live documents
function unwrapElement(element) {
  'use strict';
  const parent = element.parentElement;

  // Avoid issues with documentElement or detached elements
  if(!parent) {
    return;
  }

  // Move each child of the element to the position preceding the element in
  // the parent's node list, maintaining child order.
  while(element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  // Now the element is empty so detach it
  element.remove();
}

function fadeElement(element, duration, delay, callback) {
  'use strict';
  if(element.style.display == 'none') {
    element.style.display = '';
    element.style.opacity = '0';
  }

  if(!element.style.opacity) {
    element.style.opacity = element.style.display == 'none' ? '0' : '1';
  }

  if(callback) {
    element.addEventListener('webkitTransitionEnd', function fadeEnd(event) {
      event.target.removeEventListener('webkitTransitionEnd', fadeEnd);
      callback(element);
    });
  }

  // property duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity == '1' ? '0' : '1';
}

/**
 * NOTE: the start timer is basically to debounce calls to this function
 * whereas the interval timer is to track the interval and stop it when
 * finished
 * @param element {Element} the element to scroll
 * @param delta {int} the amount of pixels by which to scroll per increment
 * @param targetY {int} the desired vertical end position
 */
function scrollElementTo(element, delta, targetY) {
  'use strict';
  var scrollYStartTimer;
  var scrollYIntervalTimer;
  var amountToScroll = 0;
  var amountScrolled = 0;

  return function() {
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
    const currentY = element.scrollTop;
    element.scrollTop += delta;
    amountScrolled += Math.abs(delta);

    // If there was no change or we scrolled too far, then we are done.
    if(currentY == element.scrollTop || amountScrolled >= amountToScroll) {
      clearInterval(scrollYIntervalTimer);
    }
  }
}

function isValidDate(date) {
  'use strict';
  // TODO: document source (stackoverflow?)
  return date && date.toString() === '[object Date]' && isFinite(date);
}

function formatDate(date, sep) {
  'use strict';
  if(!date) {
    return '';
  }
  const parts = [];
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(sep || '');
}

function stripTags(string, replacement) {
  'use strict';
  if(!string) {
    return;
  }
  const doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = string;
  if(!replacement) {
    return doc.body.textContent;
  }
  const iterator = doc.createNodeIterator(doc.body, 
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  const values = [];
  while(node) {
    values.push(node.nodeValue);
    node = iterator.nextNode();
  }
  return values.join(replacement);
}

function stripControlCharacters(string) {
  'use strict';
  // TODO: research the proper pattern
  // /[^\x20-\x7E]+/g;
  const RE_CONTROL_CHARACTER = /[\t\r\n]/g;
  if(string) {
    return string.replace(RE_CONTROL_CHARACTER,'');
  }
}

function truncate(string, position, extension) {
  'use strict';
  const ELLIPSIS = '\u2026';
  extension = extension || ELLIPSIS;

  if(string && string.length > position) {
    return string.substr(0, position) + extension;
  }
  return string;
}

function condenseWhitespace(string) {
  'use strict';
  if(string) {
    return string.replace(/\s+/,' ');
  }
}
