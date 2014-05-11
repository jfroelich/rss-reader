// FX functions

// Animated scrolling to a target element
function smoothScrollTo(element, delta, delay) {
  var timer = setInterval(function(){
    if(document.body.scrollTop + delta >= element.offsetTop) {
      clearInterval(timer);
      window.scrollTo(0, document.body.scrollTop + element.offsetTop - document.body.scrollTop);
    } else if(element.offsetTop + element.offsetHeight >= document.body.scrollHeight - window.innerHeight) {
      // This branch is an attempt to fix a bug where the interval never clears which makes the page
      // permanently try to scroll down even when it cannot
      clearInterval(timer);
      window.scrollTo(0, document.body.scrollHeight);
    } else if(delta > 0) {
      window.scrollTo(0, document.body.scrollTop + delta);
    }
  }, delay);
}

// Vertically shrink and hide element
function shrink(el, delta, delay, callback) {
  var timer = setInterval(function() {
    if(el.offsetHeight <= delta) {
      clearInterval(timer);
      el.style.display='none';
      if(callback) {
        callback();
      }
    } else {
      el.style.height = el.offsetHeight - delta;
    }
  }, delay);
}

// Fade an element in/out
// Elements must have opacity defined as 0 or 1 for this to work
function fade(element, duration, delay, callback) {
  if(element.style.display == 'none') {
    element.style.display = '';
    element.style.opacity = '0';
  }

  if(!element.style.opacity) {
    element.style.opacity = element.style.display == 'none' ? '0' : '1';
  }

  element.addEventListener('webkitTransitionEnd', function webkitTransitionEnd(event) {
    event.target.removeEventListener('webkitTransitionEnd', webkitTransitionEnd);
    if(callback) callback(element);
  });

  // element duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity == '1' ? '0' : '1';
}
