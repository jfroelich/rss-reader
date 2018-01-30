
// for some reason, tab index and focus fucks it all up??
// Ok, so I learned a few  things:
// 1) It is the call to focus that fucks it all up. Absolutely no idea
// 2) For each slide need to set max-width: 100%, min-width: 100%, and
// min-height: 100% 3) Padding fucks up slide width

// TODO: what if I defer focus until transition end?

// Ok, the problem with focus right now is that there are TWO transitions. And
// it is a race condition. Whichever one finishes last gets focus. To avoid it,
// idea is that dynamically add and remove the transition property to only the
// latter slide. Ok this explains why the slide ended up positioned wrong. When
// the latter transition was still animating, I bet the call to focus on the
// other element when its transition finished first is what interrupted the
// transition, and probably canceled it. Since the transition is on the left
// property, and left is being periodically incremented or decremented into its
// desired value, and it gets interrupted, it gets a strange left value right at
// that point, and that explains why one slide is something like halfway
// positioned on the screen. Perhaps I should look into how focus cancels
// transitions.

// Ok, it works. This solves the layout problem, and focus works so keyboard
// shortcuts for scrolling work.

// TODO: Ok, now there is a new problem. Quick moves in succession, where the
// user presses key to navigate to next slide while the current slide operation
// is still transitioning its elements into place. Notably, if I don't need
// focus and all that, and don't try to set it, there is no problem, and the
// transition interrupts itself and starts going in reverse or speeds up to
// next. I need to have focus so scroll works, but I really like that smoothness
// over the craptastic experience of the current implementation. Quick fix that
// I am not happy with is to use something like a lock flag. Try that. Ok, that
// works. But, now transitions are not cancelable by key press. I kind of liked
// it :(


// Another minor issue, because i move current slide out of view on slide
// operation first, i see the white background appear. Kind of like a flash. I'd
// rather not have the flash. Changing transition to 'all' instead of 'left' did
// nothing. I think actually this is because I no longer have both transitions
// occuring. Idea. What if I keep both transitions attached, and then instead of
// always calling focus, I conditionally call focus only when both are complete
// and only on the current slide.
// Ok, first try not even waiting for both to complete bcause that is simpler,
// and just call focus on current slide instead of event.target. ok that worked.
// also, whatever i did, not sure why, but now the double keypress thing works
// again.

// One issue with incorrect decrement of activeTransitionCount. I think it is
// because I call currentSlide.style.left = '0'. It sets first slide left
// property and causes transition, and that decrements activeTransitionCount. ok
// i fixed that. Also, not sure why but double key press thing no longer works
// again. :(

// One another issue. This will not be present later in real slideshow because
// slides are dynamically added with the proper initial left property. But right
// now, on page load, sometimes, sporadically, the first slide slides into view.
// That's wrong. The slide should be immediately in view. ok, fixed by not
// defining it in css.

// Only remaining issue isn't a bug, just a preference. I wish I could double
// key press while in transition. Ok i fixed it by letting activeTransitionCount
// go negative. So it works! But, last problem. Why.


const container = document.getElementById('container');
const slides = container.querySelectorAll('section');

let activeTransitionCount = 0;

let currentSlide = slides[0];
currentSlide.style.left = '0';

for (const slide of slides) {
  // Do not define in css, define here only, otherwise it causes initial slide
  // transition
  // left: 100%;

  if (slide === currentSlide) {
    slide.style.left = '0';
  } else {
    slide.style.left = '100%';
  }

  // Tab index is required in order for calling slide.focus() to not be a no-op
  slide.setAttribute('tabindex', '-1');

  // We need to delay focus until after the transition completes to avoid
  // interrupting the transition, so add a listener that lets us know when it
  // completes.
  slide.addEventListener('webkitTransitionEnd', onTransitionEnd);

  slide.style.transition = 'left 0.35s ease-in-out';
}

function onTransitionEnd(event) {
  // The listener is bound to each slide
  const slide = event.target;

  // slide is not guaranteed to be equal to currentSlide. We fire off two
  // transitions per animation.
  currentSlide.focus();

  // Reset inTransition so that navigation keys work again
  // Do not let it go negative. It can go negative because of first slide issue.

  // TEMP: see if letting it go negative allows double key press
  // if(activeTransitionCount) {
  activeTransitionCount--;
  //}
}

window.addEventListener('keydown', function(event) {

  const left = 37, right = 39;

  // NOTE: there is a premature decrement right now, so need to compare against
  // 0, not just if truthy number, because -1 also means not-in-transition. Ok,
  // that bug is fixed, BUT, I am going to leave this here anyway. Notably it
  // never reaches 2. It is always either 0 or 1 now.

  // SIDE NOTE: this early exit applies to all key presses right now. It
  // triggers for things like down arrow and up arrow as well. Keep that in
  // mind.


  if (event.keyCode === left) {
    // DRY because only return early if it is one of the key codes of interest
    if (activeTransitionCount > 0) {
      console.debug('canceling', activeTransitionCount);
      return;
    }

    if (currentSlide && currentSlide.previousElementSibling) {
      // Move the current slide out of view to the right
      currentSlide.style.left = '100%';

      activeTransitionCount++;

      // Move the previous slide into view from the left
      const previousSlide = currentSlide.previousElementSibling;
      // previousSlide.style.transition = 'left 0.5s ease-in';
      previousSlide.style.left = '0';

      currentSlide = previousSlide;
    }
  } else if (event.keyCode === right) {
    // DRY because only return early if it is one of the key codes of interest
    if (activeTransitionCount > 0) {
      console.debug('canceling', activeTransitionCount);
      return;
    }

    if (currentSlide && currentSlide.nextElementSibling) {
      // Move the current slide out of view to the left
      currentSlide.style.left = '-100%';

      activeTransitionCount++;

      // Move the next slide into view from the right
      const nextSlide = currentSlide.nextElementSibling;
      nextSlide.style.left = '0';
      currentSlide = nextSlide;
    }
  }

});
