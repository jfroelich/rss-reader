// TODO: consider using MutationObserver instead

// Eventually fires scroll event on vertical scroll events. deltaY
// is a property of the event that is the change in vertical. 
// Negative deltaY is down, positive is up. deltaY is always 
// undefined on the first event but not thereafter.
var ScrollEnd = {
  listeners_: [],
  start: function(delay) {
    this.delay_ = delay > 0 ? delay : 2000;
    document.addEventListener('scroll', this.onscroll_);
  },
  stop: function() {
    document.removeEventListener('scroll', this.onscroll_);
  },
  addListener: function(listener) {
    this.listeners_.push(listener);
  },
  removeListener: function(listener) {
    var index = this.listeners_.indexOf(listener);
    if(index > -1) this.listeners_.splice(index, 1);
  },
  broadcast_: function(event) {
    ScrollEnd.listeners_.forEach(function(listener) {
      listener(event);
    });
  },
  onscroll_: function(event) {
    if(!ScrollEnd.listeners_.length)
      return;

    clearTimeout(ScrollEnd.timer_);
    ScrollEnd.timer_ = setTimeout(function() {
      if(!ScrollEnd.canCalculateDelta_) {
        ScrollEnd.broadcast_(event);
        ScrollEnd.canCalculateDelta_ = 1;
      } else {
        var deltaY = ScrollEnd.pageYOffset_ - window.pageYOffset;
        if(deltaY) {
          event.deltaY = deltaY;
          ScrollEnd.broadcast_(event);
        }
      }

      ScrollEnd.pageYOffset_ = window.pageYOffset;
    }, ScrollEnd.delay_);            
  }
};

ScrollEnd.start(200);