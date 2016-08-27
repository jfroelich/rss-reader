// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function smooth_scroll_to(element, deltaY, targetY) {
  let scroll_y_start_timer; // debounce
  let scroll_y_interval_timer; // incrementally move
  let amount_to_scroll = 0;
  let amount_scrolled = 0;

  function debounce() {
    clearTimeout(scroll_y_start_timer);
    clearInterval(scroll_y_interval_timer);
    scroll_y_start_timer = setTimeout(start_scroll, 5);
  }

  function start_scroll() {
    amount_to_scroll = Math.abs(targetY - element.scrollTop);
    amount_scrolled = 0;

    if(amount_to_scroll === 0) {
      return;
    }

    scroll_y_interval_timer = setInterval(do_scroll_step, 20);
  }

  function do_scroll_step() {
    const current_y = element.scrollTop;
    element.scrollTop += deltaY;
    amount_scrolled += Math.abs(deltaY);
    if(current_y === element.scrollTop || amount_scrolled >= amount_to_scroll) {
      clearInterval(scroll_y_interval_timer);
    }
  }

  return debounce();
}
