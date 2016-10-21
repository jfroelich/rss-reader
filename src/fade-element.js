// See license.md

'use strict';

function fade_element(element, duration, delay, callback) {
  const style = element.style;
  if(style.display === 'none') {
    style.display = '';
    style.opacity = '0';
  }

  if(!style.opacity)
    style.opacity = style.display === 'none' ? '0' : '1';

  if(callback)
    element.addEventListener('webkitTransitionEnd', on_fade_end);

  // transition params: property duration function delay
  style.transition = `'opacity ${duration}s ease ${delay}s'`;
  style.opacity = style.opacity === '1' ? '0' : '1';

  function on_fade_end(event) {
    element.removeEventListener('webkitTransitionEnd', on_fade_end);
    // TODO: why callback with element?
    callback(element);
  }
}
