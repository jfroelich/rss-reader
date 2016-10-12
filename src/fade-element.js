// See license.md

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
    element.addEventListener('webkitTransitionEnd',
      _onFadeEnd.bind(element, callback));
  }

  // property duration function delay
  style.transition = `'opacity ${duration}s ease ${delay}s'`;
  style.opacity = style.opacity === '1' ? '0' : '1';

  function _onFadeEnd(callback, event) {
    event.target.removeEventListener('webkitTransitionEnd', _onFadeEnd);
    callback(event.target);
  }
}
