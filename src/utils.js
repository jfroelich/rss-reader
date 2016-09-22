// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.utils = {};

rdr.utils.fade = function(element, duration, delay, callback) {
  const style = element.style;

  if(style.display === 'none') {
    style.display = '';
    style.opacity = '0';
  }

  if(!style.opacity) {
    style.opacity = style.display === 'none' ? '0' : '1';
  }

  if(callback) {
    element.addEventListener('webkitTransitionEnd',
      rdr.utils._fadeOnEnd.bind(element, callback));
  }

  // property duration function delay
  style.transition = 'opacity ' + duration + 's ease ' + delay + 's';
  style.opacity = style.opacity === '1' ? '0' : '1';
};

rdr.utils._fadeOnEnd = function(callback, event) {
  event.target.removeEventListener('webkitTransitionEnd', rdr.utils._fadeOnEnd);
  callback(event.target);
};

// Returns a new string where certain non-printable characters have been
// removed.
// TODO: The regex is from somewhere on stackoverflow, note it
rdr.utils.filterControlChars = function(inputString) {
  return inputString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
};

// NOTE: this is shallow. If a property is an object, its fields are not
// affected.
// TODO: do I even want to restrict to own props?
// TODO: what is better/faster? typeof or === undefined keyword?
// TODO: should clone be an option? like a flag, only clone if needed
// TODO: test how assign clones dates and url objects?

rdr.utils.filterEmptyProps = function(obj) {
  console.assert(obj);
  // Clone the object to ensure purity. Assume the input is immutable.
  const clone = Object.assign({}, obj);
  // Alias the native hasOwnProperty in case the object's hasOwnProperty is
  // tainted
  const hasOwnProperty = Object.prototype.hasOwnProperty;
  const undef = void(0);
  for(let prop in clone) {
    if(hasOwnProperty.call(clone, prop)) {
      if(clone[prop] === undef || clone[prop] === null) {
        delete clone[prop];
      }
    }
  }

  return clone;
};

// Formats a date object. This is obviously a very dumb implementation that
// could eventually be improved.
rdr.utils.formatDate = function(date, delimiter) {
  const parts = [];
  if(date) {
    // getMonth is a zero based index
    parts.push(date.getMonth() + 1);
    parts.push(date.getDate());
    parts.push(date.getFullYear());
  }
  return parts.join(delimiter || '');
};

// @param descriptors {Array} an array of basic descriptor objects such as the
// one produced by the parseSrcset library
rdr.utils.serializeSrcset = function(descriptors) {
  console.assert(descriptors);

  const outputBuffer = [];
  for(let descriptor of descriptors) {
    let descBuffer = [descriptor.url];
    if(descriptor.d) {
      descBuffer.push(' ');
      descBuffer.push(descriptor.d);
      descBuffer.push('x');
    } else if(descriptor.w) {
      descBuffer.push(' ');
      descBuffer.push(descriptor.w);
      descBuffer.push('w');
    } else if(descriptor.h) {
      descBuffer.push(' ');
      descBuffer.push(descriptor.h);
      descBuffer.push('h');
    }

    outputBuffer.push(descBuffer.join(''));
  }

  // The space is important
  return outputBuffer.join(', ');
};

rdr.utils.scrollTo = function(element, deltaY, targetY) {
  let scrollYStartTimer; // debounce
  let scrollYIntervalTimer; // incrementally move
  let amountToScroll = 0;
  let amountScrolled = 0;

  function debounce() {
    clearTimeout(scrollYStartTimer);
    clearInterval(scrollYIntervalTimer);
    scrollYStartTimer = setTimeout(start_scroll, 5);
  }

  function start_scroll() {
    amountToScroll = Math.abs(targetY - element.scrollTop);
    amountScrolled = 0;

    if(amountToScroll === 0) {
      return;
    }

    scrollYIntervalTimer = setInterval(do_scroll_step, 20);
  }

  function do_scroll_step() {
    const currentY = element.scrollTop;
    element.scrollTop += deltaY;
    amountScrolled += Math.abs(deltaY);
    if(currentY === element.scrollTop || amountScrolled >= amountToScroll) {
      clearInterval(scrollYIntervalTimer);
    }
  }

  return debounce();
};
