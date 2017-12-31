
// for some reason, tab index and focus fucks it all up??
// Ok, so I learned a few  things:
// 1) It is the call to focus that fucks it all up. Absolutely no idea
// 2) For each slide need to set max-width: 100%, min-width: 100%, and min-height: 100%
// 3) Padding fucks up slide width

// TODO: what if I defer focus until transition end?

// Ok, the problem with focus right now is that there are TWO transitions. And it is a race
// condition. Whichever one finishes last gets focus.
// To avoid it, idea is that dynamically add and remove the transition property to only the
// latter slide. Ok this explains why the slide ended up positioned wrong. When the latter
// transition was still animating, I bet the call to focus on the other element when its transition
// finished first is what interrupted the transition, and probably canceled it. Since the transition
// is on the left property, and left is being periodically incremented or decremented into its
// desired value, and it gets interrupted, it gets a strange left value right at that point, and
// that explains why one slide is something like halfway positioned on the screen. Perhaps I
// should look into how focus cancels transitions.

// Ok, it works. This solves the layout problem, and focus works so keyboard shortcuts for
// scrolling work.

// TODO: Ok, now there is a new problem. Quick moves in succession, where the user presses key to
// navigate to next slide while the current slide operation is still transitioning its elements
// into place. Notably, if I don't need focus and all that, and don't try to set it, there is
// no problem, and the transition interrupts itself and starts going in reverse or speeds up to
// next. I need to have focus so scroll works, but I really like that smoothness over the
// craptastic experience of the current implementation. Quick fix that I am not happy with is
// to use something like a lock flag. Try that.
// Ok, that works. But, now transitions are not cancelable by key press. I kind of liked it :(


// Another minor issue, because i move current slide out of view on slide operation first, i
// see the white background appear. Kind of like a flash. I'd rather not have the flash. Changing
// transition to 'all' instead of 'left' did nothing. I think actually this is because I
// no longer have both transitions occuring. Idea. What if I keep both transitions attached,
// and then instead of always calling focus, I conditionally call focus only when both are complete
// and only on the current slide.
// Ok, first try not even waiting for both to complete bcause that is simpler, and just
// call focus on current slide instead of event.target.


const container = document.getElementById('container');
const slides = container.querySelectorAll('section');

let inTransition = false;

let currentSlide = slides[0];
currentSlide.style.left = '0';

for(const slide of slides) {

  // Tab index is required in order for calling slide.focus() to not be a no-op
  slide.setAttribute('tabindex', '-1');

  // We need to delay focus until after the transition completes to avoid interrupting the
  // transition, so add a listener that lets us know when it completes.
  slide.addEventListener('webkitTransitionEnd', onTransitionEnd);

  // TEMP: define transition on all to see if it avoids white flash
  slide.style.transition = 'left 0.5s ease-in';
}

function onTransitionEnd(event) {

  // The listener is bound to each slide
  const slide = event.target;

  // The transition property is dynamically added each time the slideshow slides instead of
  // statically from css. This is done in order to avoid having two transitions fire when
  // sliding (the current element being slid out of view and the element sliding into view),
  // because I modify the same transition property for both (the 'left' css property), but only
  // want one of the two property changes to have an associated transition.
  // I decided to not eagerly remove the transition property after the transition starts for fear
  // of canceling it. So that css property is still sitting there on the element, and now must be
  // removed, so that later changes to the property of the slide do not unintentionally re-trigger
  // the transition effect. This happens specifically when the slide becomes the other slide in
  // the pair of slides being moved (the two slides for whom this sets the css left prop at the
  // same time).
  // An alternative method would be to attach and detach the listener. But I am currently assuming
  // that is a more expensive operation than modifying a css property.

  // TEMP: disable this to see if i can avoid white flash
  //slide.style.transition = '';

  // TEMP: disable this to see if i can avoid white flash
  // Now that the transition completed, set the focus.
  //slide.focus();

  // TEMP: testing, see if setting current slide avoids issue
  currentSlide.focus();


  // Reset inTransition so that navigation keys work again
  inTransition = false;
}

window.addEventListener('keydown', function(event) {

  const left = 37, right = 39;

  if(inTransition) {
    console.debug('Ignored key press %d while in transition', event.keyCode);
    return;
  }

  if(event.keyCode === left) {
    if(currentSlide && currentSlide.previousElementSibling) {


      // Move the current slide out of view to the right
      currentSlide.style.left = '100%';

      inTransition = true;

      // Move the previous slide into view from the left
      const previousSlide = currentSlide.previousElementSibling;
      //previousSlide.style.transition = 'left 0.5s ease-in';
      previousSlide.style.left = '0';

      currentSlide = previousSlide;

    }
  } else if(event.keyCode === right) {
    if(currentSlide && currentSlide.nextElementSibling) {

      // Move the current slide out of view to the left
      currentSlide.style.left = '-100%';

      inTransition = true;

      // Move the next slide into view from the right
      const nextSlide = currentSlide.nextElementSibling;
      //nextSlide.style.transition = 'left 0.5s ease-in';
      nextSlide.style.left = '0';


      currentSlide = nextSlide;

    }

  }

});
