// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

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
    element.addEventListener('webkitTransitionEnd', onFadeEnd);
  }

  // property duration function delay
  style.transition = 'opacity ' + duration + 's ease ' + delay + 's';
  style.opacity = style.opacity === '1' ? '0' : '1';

  function onFadeEnd(event) {
    event.target.removeEventListener('webkitTransitionEnd', onFadeEnd);
    callback(element);
  }
}
