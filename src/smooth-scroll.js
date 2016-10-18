// See license.md

'use strict';

{

// TODO: go back to using initial setTimeout because this is bad when
// holding down button

let scroll_active = false;
function smooth_scroll(element, dy, targetY) {
  if(scroll_active)
    return;
  if(dy < 0 && element.scrollTop === 0)
    return;

  scroll_active = true;
  const abs_dy = Math.abs(dy);
  let distance = Math.abs(targetY - element.scrollTop);
  let id = setInterval(function modifyScrollTop() {
    if(distance < abs_dy) {
      clearInterval(id);
      scroll_active = false;
    } else {
      const before = element.scrollTop;
      element.scrollTop += dy;
      if(element.scrollTop === before) {
        clearInterval(id);
        scroll_active = false;
      } else {
        distance -= Math.abs(element.scrollTop - before);
      }
    }
  }, 20);
}

this.smooth_scroll = smooth_scroll;

}
