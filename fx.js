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

// Fade in/out an element by modifying opacity
function fade(element, delta, delay) {
  var op, timer;

  if(delta >= 0) {
    // fade in
    op = 0.0;
    timer = setInterval(function() {
      if(op >= 1.0) {
        clearInterval(timer);
        op = 1.0;
      }
      element.style.opacity = op;
      op += delta;
    }, delay);
  } else {
    // fade out
    op = 1.0;
    timer = setInterval(function() {
      if(op <= 0.0) {
        clearInterval(timer);
        op = 0.0;
      }
      element.style.opacity = op;
      op += delta;
    }, delay);
  }
}