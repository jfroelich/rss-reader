// See license.md

'use strict';

// TODO: go back to using initial setTimeout because this is bad when
// holding down button
let smooth_scroll_is_active = false;
function smooth_scroll(element, dy, target_y) {
  if(smooth_scroll_is_active)
    return;
  if(dy < 0 && element.scrollTop === 0)
    return;
  smooth_scroll_is_active = true;
  const abs_dy = Math.abs(dy);
  let distance = Math.abs(target_y - element.scrollTop);
  let interval_id = setInterval(function modify_scroll_top() {
    if(distance < abs_dy) {
      clearInterval(interval_id);
      smooth_scroll_is_active = false;
    } else {
      const before = element.scrollTop;
      element.scrollTop += dy;
      if(element.scrollTop === before) {
        clearInterval(interval_id);
        smooth_scroll_is_active = false;
      } else {
        distance -= Math.abs(element.scrollTop - before);
      }
    }
  }, 20);
}
