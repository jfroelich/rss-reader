(function(exports, until) {
'use strict';

// TODO: use clear key names here, I just need to keep the digits
// in the key, but can use anything for value. Using key names 
// in value is clearer.
// TODO: look for constants that represent these
// TODO: use an if statement instead of hasOwnProperty
var NEXT_KEYS = {'32':32, '39':39, '78':78};

var PREV_KEYS = {'37':37, '80':80};

var ELEMENT_ENTRIES;

function scrollToNextEntry(entry) {
  if(entry.offsetTop + entry.offsetHeight - pageYOffset > 40) {
    window.scrollTo(0, entry.nextSibling ? entry.nextSibling.offsetTop : entry.offsetTop + entry.offsetHeight);
    return false;
  }
  
  // Keep looking
  return true;
}

function scrollToPreviousEntry(entry) {

  if(entry.offsetTop >= pageYOffset) {
    // Found a previous entry
    if(entry.previousSibling) {
      window.scrollTo(0, entry.previousSibling.offsetTop);
    } else if(pageYOffset !== 0) {
      window.scrollTo(0, entry.offsetTop);
    } else {
      console.log('Unclear case for prev key navigation? Maybe already at top?');
      // TODO: test this case more
    }
    return false;
  } else if(!entry.nextSibling) {

    // Nothing to scroll to, go to the top of the page
    // TODO: maybe don't call it if we are already at the top? or maybe
    // scroll to is smart enough to do nothing in this case
    window.scrollTo(0, entry.offsetTop);
    return false;
  }
  
  // Keep looking
  return true;
}

function keyDownListener(event) {
  if(event.target != document.body) {
    // Ignore keydowns on other things
    // like text inputs. 
    // TODO: what about embedded iframes? maybe this can
    // intercept those events and fix the click through issue?
    return;
  }

  if(NEXT_KEYS.hasOwnProperty(event.keyCode)) {
    // Prevent the page down effect of spacebar
    event.preventDefault();
    until(ELEMENT_ENTRIES.childNodes, scrollToNextEntry);
  } else if(PREV_KEYS.hasOwnProperty(event.keyCode)) {
    until(ELEMENT_ENTRIES.childNodes, scrollToPreviousEntry);
  }
}


window.addEventListener('keydown', keyDownListener);

function init() {
    document.removeEventListener('DOMContentLoaded', init);
    ELEMENT_ENTRIES = document.getElementById('entries');
}
document.addEventListener('DOMContentLoaded', init)

})(this, chrome.extension.getBackgroundPage().until);