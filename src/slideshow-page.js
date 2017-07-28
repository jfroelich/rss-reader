// See license.md

'use strict';

{ // Begin file block scope

// Reference to element
let currentSlideElement = null;

// TODO: should poll channel really be distinct from db? Not so sure anymore.
// Maybe I just want to use a general "extension" channel that handles all
// extension related messages? Perhaps the only major qualifying characteristic
// is the persistence of listening for messages for the lifetime of the page,
// and organizing the logic according to the content of the response is done
// with the conditions within the listener. There are different message
// frequencies so some conditions are rarely true which means some wasted
// checks, but on the other hand there are less channels. Would it be simpler,
// and would the added simplicity outweight any performance benefit/cost, or
// is there not even really much of a perf cost.

const settingsChannel = new BroadcastChannel('settings');
settingsChannel.onmessage = function(event) {
  if(event.data === 'changed') {
    updateEntryCSSRules(event);
  }
};

const dbChannel = new BroadcastChannel('db');
dbChannel.onmessage = function(event) {
  if(event.data && event.data.type === 'entryArchived') {
    console.log('Received archive entry request message');
  } else if(event.data && event.data.type === 'entryDeleted') {
    console.log('Received entry delete request message');
  }
};


const pollChannel = new BroadcastChannel('poll');
pollChannel.onmessage = function(event) {
  if(event.data === 'completed') {
    console.debug('Received poll completed message, maybe appending slides');
    const count = countUnreadSlides();
    if(count < 2) {
      appendSlides();
    }
  }
};

function removeSlide(slideElement) {
  slideElement.removeEventListener('click', slideOnClick);
  slideElement.remove();
}

// TODO: visual feedback in event of an error?
async function markSlideRead(slideElement) {

  // This is not an error. This happens routinely as a result of navigating
  // to prior articles then navigating forward. It is not the responsibility
  // of the caller to only call markSlideRead on unread slides
  if(slideElement.hasAttribute('read')) {
    return;
  }

  const entryIdString = slideElement.getAttribute('entry');
  const entryIdInt = parseInt(entryIdString, 10);
  let conn;

  try {
    conn = await openReaderDb();
    await markEntryRead(conn, entryIdInt);
    slideElement.setAttribute('read', '');
  } catch(error) {
    console.error(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

// TODO: use getAll, passing in a count parameter as an upper limit, and
// then using slice or unshift or something to advance.
// TODO: internally the parameter to getAll might be (offset+limit)
function getUnarchivedUnreadEntries(conn, offset, limit) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = () => resolve(entries);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if(!cursor) {
        return;
      }
      if(offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
        return;
      }
      entries.push(cursor.value);
      if(limited && ++counter < limit) {
        cursor.continue();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// TODO: require caller to establish conn, do not do it here?
// TODO: visual feedback on error
async function appendSlides() {
  const limit = 3;
  const offset = countUnreadSlides();


  let conn;
  let entryArray = [];
  try {
    conn = await openReaderDb();
    entryArray = await getUnarchivedUnreadEntries(conn, offset, limit);
  } catch(error) {
    console.error(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  for(let entryObject of entryArray) {
    appendSlide(entryObject);
  }

  return entryArray.length;
}

// Add a new slide to the view.
function appendSlide(entryObject) {
  const containerElement = document.getElementById('slideshow-container');
  const slideElement = document.createElement('div');

  // tabindex must be explicitly defined on a div in order for div.focus() to
  // affect the active element
  slideElement.setAttribute('tabindex', '-1');

  slideElement.setAttribute('entry', entryObject.id);
  slideElement.setAttribute('feed', entryObject.feed);
  slideElement.setAttribute('class','entry');
  slideElement.addEventListener('click', slideOnClick);
  slideElement.style.position = 'absolute';

  if(containerElement.childElementCount) {
    slideElement.style.left = '100%';
    slideElement.style.right = '-100%';
  } else {
    slideElement.style.left = '0%';
    slideElement.style.right = '0%';
  }

  slideElement.style.overflowX = 'hidden';
  slideElement.style.top = '0';
  slideElement.style.bottom = '0';
  slideElement.style.transition = 'left 0.5s ease-in 0s, right 0.5s ease-in';

  const titleElement = createArticleTitle(entryObject);
  slideElement.appendChild(titleElement);
  const contentElement = createArticleContent(entryObject);
  slideElement.appendChild(contentElement);
  const sourceElement = createFeedSource(entryObject);
  slideElement.appendChild(sourceElement);

  containerElement.appendChild(slideElement);

  // TODO: this might be wrong if multiple unread slides are initially appended
  // I need to ensure currentSlideElement is always set. Where do I do this?
  if(containerElement.childElementCount === 1) {
    currentSlideElement = slideElement;
    currentSlideElement.focus();
  }
}

function createArticleTitle(entryObject) {
  const titleElement = document.createElement('a');
  titleElement.setAttribute('href', getEntryURLString(entryObject));
  titleElement.setAttribute('class', 'entry-title');
  titleElement.setAttribute('target','_blank');
  titleElement.setAttribute('rel', 'noreferrer');
  titleElement.setAttribute('title', entryObject.title || 'Untitled');
  if(entryObject.title) {
    titleElement.setAttribute('title', entryObject.title);
    let titleText = entryObject.title;
    titleText = filterArticleTitle(titleText);
    titleText = truncateHTML(titleText, 300);
    titleElement.innerHTML = titleText;
  } else {
    titleElement.setAttribute('title', 'Untitled');
    titleElement.textContent = 'Untitled';
  }

  return titleElement;
}

function createArticleContent(entryObject) {
  const contentElement = document.createElement('span');
  contentElement.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  contentElement.innerHTML = entryObject.content;
  return contentElement;
}

function createFeedSource(entryObject) {
  const sourceElement = document.createElement('span');
  sourceElement.setAttribute('class','entrysource');

  if(entryObject.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', entryObject.faviconURLString);
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    sourceElement.appendChild(faviconElement);
  }

  const titleElement = document.createElement('span');
  if(entryObject.feedLink) {
    titleElement.setAttribute('title', entryObject.feedLink);
  }

  const buffer = [];
  buffer.push(entryObject.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entryObject.author || 'Unknown author');
  if(entryObject.datePublished) {
    buffer.push(' on ');
    buffer.push(formatDate(entryObject.datePublished));
  }
  titleElement.textContent = buffer.join('');
  sourceElement.appendChild(titleElement);

  return sourceElement;
}

function filterArticleTitle(title) {
  let index = title.lastIndexOf(' - ');

  if(index === -1) {
    index = title.lastIndexOf(' | ');
  }

  if(index === -1) {
    index = title.lastIndexOf(' : ');
  }

  if(index === -1) {
    return title;
  }

  // todo: should this be +3 given the spaces wrapping the delim?
  const tailString = title.substring(index + 1);
  const tailWords = tailString.split(/\s+/g);
  const nonEmptyTailWords = tailWords.filter((w) => w);
  const wordCount = nonEmptyTailWords.length;

  let outputTitle;

  if(wordCount < 5) {
    outputTitle = title.substring(0, index);
    outputTitle = outputTitle.trim();
  } else {
    outputTitle = title;
  }

  return outputTitle;
}

function slideOnClick(event) {
  const leftMouseButtonCode = 1;
  if(event.which !== leftMouseButtonCode) {
    return true;
  }

  const anchor = event.target.closest('a');
  if(!anchor) {
    return true;
  }
  if(!anchor.hasAttribute('href')) {
    return true;
  }

  const urlString = anchor.getAttribute('href');

  chrome.tabs.create({'active': true, 'url': urlString});

  markSlideRead(currentSlideElement);
  event.preventDefault();
  return false;
}

// TODO: this is connecting twice now, I want to be using only a single conn
// for both append slides and markSlideRead
// TODO: there is some minor annoyance, that in the case of append, this
// does the animation super fast
// TODO: visual feedback on error
async function showNextSlide() {

  // If slide count is 0, currentSlideElement may be undefined
  if(!currentSlideElement) {
    console.warn('No current slide');
    return;
  }

  const oldSlideElement = currentSlideElement;

  // Conditionally append more slides
  const unreadCount = countUnreadSlides();
  let numAppended = 0;
  if(unreadCount < 2) {
    numAppended = await appendSlides();
  }

  if(currentSlideElement.nextSibling) {
    currentSlideElement.style.left = '-100%';
    currentSlideElement.style.right = '100%';
    currentSlideElement.nextSibling.style.left = '0px';
    currentSlideElement.nextSibling.style.right = '0px';
    currentSlideElement.scrollTop = 0;
    currentSlideElement = currentSlideElement.nextSibling;

    // Change the active element to the new current slide, so that scrolling
    // using keyboard keys still works
    currentSlideElement.focus();

    // TODO: I don't think this should be awaited, it should be async
    await markSlideRead(oldSlideElement);
  }

  // Shrink the number of slides
  if(numAppended > 0) {
    const containerElement = document.getElementById('slideshow-container');
    while(containerElement.childElementCount > 6 &&
      containerElement.firstChild !== currentSlideElement) {
      removeSlide(containerElement.firstChild);
    }
  }
}

// Move the current slide out of view to the right, and move the previous
// slide into view, and then update the current slide.
function showPreviousSlide() {

  if(!currentSlideElement) {
    return;
  }

  const previousSlideElement = currentSlideElement.previousSibling;
  if(!previousSlideElement) {
    return;
  }

  currentSlideElement.style.left = '100%';
  currentSlideElement.style.right = '-100%';
  previousSlideElement.style.left = '0px';
  previousSlideElement.style.right = '0px';
  currentSlideElement = previousSlideElement;

  // Change the active element to the new current slide, so that scrolling
  // using keyboard keys still works
  currentSlideElement.focus();
}

function countUnreadSlides() {
  const unreadSlideList =
    document.body.querySelectorAll('div[entry]:not([read])');
  return unreadSlideList.length;
}

function formatDate(dateObject, delimiterString) {
  const partArray = [];
  if(dateObject) {
    // getMonth is a zero based index
    partArray.push(dateObject.getMonth() + 1);
    partArray.push(dateObject.getDate());
    partArray.push(dateObject.getFullYear());
  }
  return partArray.join(delimiterString || '/');
}

let navKeydownTimer = null;
window.addEventListener('keydown', function(event) {
  // Redefine space from page down to navigate next
  const LEFT = 37, RIGHT = 39, N = 78, P = 80, SPACE = 32;
  const code = event.keyCode;

  if(code === RIGHT || code === N || code === SPACE) {
    event.preventDefault();
    cancelIdleCallback(navKeydownTimer);
    navKeydownTimer = requestIdleCallback(showNextSlide);
  } else if(code === LEFT || code === P) {
    event.preventDefault();
    cancelIdleCallback(navKeydownTimer);
    navKeydownTimer = requestIdleCallback(showPreviousSlide);
  }
});

// Override built in keyboard scrolling
// TODO: look into the new 'passive' flag for scroll listeners
let scrollCallbackHandle;
window.addEventListener('keydown', function(event) {

  const DOWN = 40, UP = 38;

  if(event.keyCode !== DOWN && event.keyCode !== UP) {
    return;
  }

  if(!document.activeElement) {
    return;
  }

  event.preventDefault();
  cancelIdleCallback(scrollCallbackHandle);

  scrollCallbackHandle = requestIdleCallback(function() {
    document.activeElement.scrollTop += event.keyCode === UP ? -200 : 200;
  });
});



document.addEventListener('DOMContentLoaded', function(event) {
  addEntryCSSRules();
  appendSlides();
}, {'once': true});

} // End file block scope
