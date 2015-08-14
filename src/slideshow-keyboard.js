// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// NOTE: interacts with global 'currentSlide' variable from slideshow.js, this eventually
// should be improved

// TODO: instead of binding this to window, bind to each slide? that way
// we don't have to use the currentSlide hack?

lucu.slideUI = lucu.slideUI || {};

lucu.slideUI.keyDownTimer = 0;

lucu.slideUI.KEY_MAP = {
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  N: 78,
  P: 80
};

lucu.slideUI.onKeyDown = function(event) {
  //event.target is body
  //event.currentTarget is window

  var key = event.keyCode;
  var km = lucu.slideUI.KEY_MAP;

  if(key == km.SPACE || key == km.DOWN || key == km.PAGE_DOWN ||
      key == km.UP || key == km.PAGE_UP) {
    event.preventDefault();
  }

  // TODO: lot of DRY violation here. I should use a {} map
  // to deltas and make one call to lucu.effects.scrollTo instead

  if(currentSlide) {
    if(key == km.DOWN) {
      lucu.effects.scrollTo(currentSlide, 50, currentSlide.scrollTop + 200)
      return;
    } else if(key == km.PAGE_DOWN) {
      lucu.effects.scrollTo(currentSlide, 100, currentSlide.scrollTop + 800);
      return;
    } else if(key == km.UP) {
      lucu.effects.scrollTo(currentSlide, -50, currentSlide.scrollTop - 200);
      return;
    } else if(key == km.PAGE_UP) {
      lucu.effects.scrollTo(currentSlide, -100, currentSlide.scrollTop - 800);
      return;
    }
  }

  if(key == km.SPACE || key == km.RIGHT || key == km.N) {
    clearTimeout(lucu.slideUI.keyDownTimer);
    lucu.slideUI.keyDownTimer = setTimeout(showNextSlide, 50);
  } else if(key == km.LEFT || key == km.P) {
    clearTimeout(lucu.slideUI.keyDownTimer);
    lucu.slideUI.keyDownTimer = setTimeout(showPreviousSlide, 50);
  }
}

window.addEventListener('keydown', lucu.slideUI.onKeyDown, false);
