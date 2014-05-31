// FX functions

var fx = {};

// Fade an element in/out
// Elements must have opacity defined as 0 or 1 for this to work
fx.fade = function(element, duration, delay, callback) {

  if(element.style.display == 'none') {
    element.style.display = '';
    element.style.opacity = '0';
  }

  if(!element.style.opacity) {
    element.style.opacity = element.style.display == 'none' ? '0' : '1';
  }

  if(callback) {
    element.addEventListener('webkitTransitionEnd', function webkitTransitionEnd(event) {
      event.target.removeEventListener('webkitTransitionEnd', webkitTransitionEnd);
      callback(element);
    });
  }

  // element duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity == '1' ? '0' : '1';
};