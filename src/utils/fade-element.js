// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function fadeElement(element, duration, delay, callback) {
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
      onTransitionEnd.bind(element, callback));
  }

  // property duration function delay
  style.transition = 'opacity ' + duration + 's ease ' + delay + 's';
  style.opacity = style.opacity === '1' ? '0' : '1';
}

function onTransitionEnd(callback, event) {
  event.target.removeEventListener('webkitTransitionEnd', onTransitionEnd);
  callback(event.target);
}

var rdr = rdr || {};
rdr.fadeElement = fadeElement;

} // End file block scope
