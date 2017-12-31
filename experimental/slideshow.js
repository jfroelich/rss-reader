
// for some reason, tab index and focus fucks it all up??
// Ok, so I learned a few  things:
// 1) It is the call to focus that fucks it all up. Absolutely no idea
// 2) For each slide need to set max-width: 100%, min-width: 100%, and min-height: 100%
// 3) Padding fucks up slide width

// TODO: what if I defer focus until transition end?

const container = document.getElementById('container');
const slides = container.querySelectorAll('section');

let currentSlide = slides[0];
currentSlide.style.left = '0';

for(const slide of slides) {
  slide.style.display = 'block';
  slide.setAttribute('tabindex', '-1');
}

//currentSlide.focus();


window.addEventListener('keydown', function(event) {

  const left = 37, right = 39;

  if(event.keyCode === left) {
    if(currentSlide && currentSlide.previousElementSibling) {
      currentSlide.style.left = '100%';
      currentSlide.previousElementSibling.style.left = '0';
      currentSlide = currentSlide.previousElementSibling;
      //currentSlide.focus();
    }
  } else if(event.keyCode === right) {
    if(currentSlide && currentSlide.nextElementSibling) {
      currentSlide.style.left = '-100%';
      currentSlide.nextElementSibling.style.left = '0';
      currentSlide = currentSlide.nextElementSibling;
      //currentSlide.focus();
    }

  }

});
