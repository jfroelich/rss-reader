// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: this should probably use an even more qualified name like
// scrollElementToY, given that it does not handle horizontal movement
// Or maybe name it verticalScrollElement
// Or write a general scrollElementTo that supports both x and y, then
// just use 0 for x.
// TODO: do not use nested functions
function scroll_element_to(element, deltaY, targetY) {
  let scrollYStartTimer; // debounce
  let scrollYIntervalTimer; // incrementally move
  let amountToScroll = 0;
  let amountScrolled = 0;

  return function debounce_scroll_to() {
    clearTimeout(scrollYStartTimer);
    clearInterval(scrollYIntervalTimer);
    scrollYStartTimer = setTimeout(start_scroll, 5);
  }();

  function start_scroll() {
    amountToScroll = Math.abs(targetY - element.scrollTop);
    amountScrolled = 0;

    if(amountToScroll === 0) {
      return;
    }

    scrollYIntervalTimer = setInterval(scroll_to_y, 20);
  }

  function scroll_to_y() {
    const currentY = element.scrollTop;
    element.scrollTop += deltaY;
    amountScrolled += Math.abs(deltaY);
    if(currentY === element.scrollTop || amountScrolled >= amountToScroll) {
      clearInterval(scrollYIntervalTimer);
    }
  }
}
