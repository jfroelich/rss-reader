// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.utils = {};

rdr.utils.condenseSpaces = function(inputString) {
  return inputString.replace(/\s{2,}/g, ' ');
};

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

// Returns a new string where Unicode Cc-class characters have been removed
// Adapted from http://stackoverflow.com/questions/4324790
rdr.utils.filterControlChars = function(inputString) {
  return inputString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
};

// A rudimentary process. Ignores prototype, deep objects, getters, etc.
// The output is a new object that is a copy of the input object. Not actually
// pure because property values are copied by reference.
// A value is empty if it is null, undefined, or an empty string
rdr.utils.filterEmptyProps = function(obj) {
  const copy = {};
  const hasOwn = Object.prototype.hasOwnProperty;
  const undef = void(0);
  for(let prop in obj) {
    if(hasOwn.call(obj, prop)) {
      const value = obj[prop];
      if(value !== undef && value !== null && value !== '') {
        copy[prop] = value;
      }
    }
  }
  return copy;
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

rdr.utils.isURLObject = function(val) {
  return Object.prototype.toString.call(val) === '[object URL]';
};

// @param descriptors {Array} an array of basic descriptor objects such as the
// one produced by the parseSrcset library
rdr.utils.serializeSrcset = function(descriptors) {
  const output = [];
  for(let descriptor of descriptors) {
    let buf = [descriptor.url];
    if(descriptor.d) {
      buf.push(' ');
      buf.push(descriptor.d);
      buf.push('x');
    } else if(descriptor.w) {
      buf.push(' ');
      buf.push(descriptor.w);
      buf.push('w');
    } else if(descriptor.h) {
      buf.push(' ');
      buf.push(descriptor.h);
      buf.push('h');
    }
    output.push(buf.join(''));
  }
  return output.join(', ');
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
