// See license.md
'use strict';

{ // Begin file block scope

let currentSlideElement = null;

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
    const count = countUnreadSlideElements();
    let conn; // leave undefined
    const verbose = true;// Temporarily true for debugging purposes
    if(count < 2) {
      appendSlides(conn, verbose);
    }
  }
};

function removeSlide(slideElement) {
  slideElement.removeEventListener('click', slideOnClick);
  slideElement.remove();
}

// TODO: visual feedback in event of an error?
async function markSlideRead(conn, slideElement, verbose) {
  // This is not an error. This happens routinely as a result of navigating
  // to prior articles then navigating forward. It is not the responsibility
  // of the caller to only call on unread slides
  if(slideElement.hasAttribute('read')) {
    return;
  }

  const entryIdString = slideElement.getAttribute('entry');
  const parseIntRadix = 10;
  const entryIdNumber = parseInt(entryIdString, parseIntRadix);
  let isLocallyCreatedConnection = false;
  let name, version, connectTimeout;
  try {
    if(!conn) {
      conn = await openReaderDb(name, version, connectTimeout, verbose);
      isLocallyCreatedConnection = true;
    }

    await markEntryRead(conn, entryIdNumber, verbose);
    slideElement.setAttribute('read', '');
  } catch(error) {
    // TODO: show an error message or something
    console.error(error);
  } finally {
    if(isLocallyCreatedConnection && conn) {
      conn.close();
    }
  }
}

// TODO: use getAll, passing in a count parameter as an upper limit, and
// then using slice or unshift or something to advance. The parameter to getAll
// might be (offset+limit)
function loadUnarchivedUnreadEntriesFromDb(conn, offset, limit, verbose) {
  return new Promise(function(resolve, reject) {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const isLimited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = function(event) {
      if(verbose) {
        console.log('Loaded %d entries from database', entries.length);
      }
      resolve(entries);
    };
    tx.onerror = function(event) {
      reject(tx.error);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(cursor) {
        if(offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          entries.push(cursor.value);
          if(isLimited && ++counter < limit) {
            cursor.continue();
          }
        }
      }
    };
  });
}

// TODO: require caller to establish conn, do not do it here?
// TODO: visual feedback on error
async function appendSlides(conn, verbose) {
  const limit = 3;
  let isLocallyCreatedConnection = false;
  let entries = [];
  let name, version, connectTimeout;

  const offset = countUnreadSlideElements();

  try {
    if(!conn) {
      conn = await openReaderDb(name, version, connectTimeout, verbose);
      isLocallyCreatedConnection = true;
    }

    entries = await loadUnarchivedUnreadEntriesFromDb(conn, offset, limit,
      verbose);
  } catch(error) {
    console.error(error);
  } finally {
    if(isLocallyCreatedConnection && conn) {
      conn.close();
    }
  }

  for(let entry of entries) {
    appendSlide(entry);
  }

  return entries.length;
}

// Add a new slide to the view.
function appendSlide(entry) {
  const containerElement = document.getElementById('slideshow-container');
  const slideElement = document.createElement('div');

  // tabindex must be explicitly defined on a div in order for div.focus() to
  // affect the active element
  slideElement.setAttribute('tabindex', '-1');

  slideElement.setAttribute('entry', entry.id);
  slideElement.setAttribute('feed', entry.feed);
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

  const titleElement = createArticleTitle(entry);
  slideElement.appendChild(titleElement);
  const contentElement = createArticleContent(entry);
  slideElement.appendChild(contentElement);
  const sourceElement = createFeedSource(entry);
  slideElement.appendChild(sourceElement);

  containerElement.appendChild(slideElement);

  // TODO: this might be wrong if multiple unread slides are initially appended
  // I need to ensure currentSlideElement is always set. Where do I do this?
  if(containerElement.childElementCount === 1) {
    currentSlideElement = slideElement;
    currentSlideElement.focus();
  }
}

function createArticleTitle(entry) {
  const titleElement = document.createElement('a');
  titleElement.setAttribute('href', getEntryURLString(entry));
  titleElement.setAttribute('class', 'entry-title');
  titleElement.setAttribute('target','_blank');
  titleElement.setAttribute('rel', 'noreferrer');
  titleElement.setAttribute('title', entry.title || 'Untitled');
  if(entry.title) {
    titleElement.setAttribute('title', entry.title);
    let titleText = entry.title;
    titleText = filterArticleTitle(titleText);
    titleText = truncateHTML(titleText, 300);
    titleElement.innerHTML = titleText;
  } else {
    titleElement.setAttribute('title', 'Untitled');
    titleElement.textContent = 'Untitled';
  }

  return titleElement;
}

function createArticleContent(entry) {
  const contentElement = document.createElement('span');
  contentElement.setAttribute('class', 'entry-content');
  // <html><body> will be implicitly stripped
  contentElement.innerHTML = entry.content;
  return contentElement;
}

function createFeedSource(entry) {
  const sourceElement = document.createElement('span');
  sourceElement.setAttribute('class','entrysource');

  if(entry.faviconURLString) {
    const faviconElement = document.createElement('img');
    faviconElement.setAttribute('src', entry.faviconURLString);
    faviconElement.setAttribute('width', '16');
    faviconElement.setAttribute('height', '16');
    sourceElement.appendChild(faviconElement);
  }

  const titleElement = document.createElement('span');
  if(entry.feedLink) {
    titleElement.setAttribute('title', entry.feedLink);
  }

  const buffer = [];
  buffer.push(entry.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if(entry.datePublished) {
    buffer.push(' on ');
    buffer.push(formatDate(entry.datePublished));
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
  // TODO: maybe this should be a call to a helper about getting words array
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
  let conn;// undefined
  const verbose = true;// temp
  markSlideRead(conn, currentSlideElement, verbose);
  event.preventDefault();
  return false;
}

// TODO: visual feedback on error
async function showNextSlide() {

  // Temporarily true for debugging purposes
  const verbose = true;

  // currentSlideElement may be undefined
  // This isn't actually an error. For example, when initially viewing the
  // slideshow before subscribing when there are no feeds and entries, or
  // initially viewing the slideshow when all entries are read.
  if(!currentSlideElement) {
    console.warn('No current slide');
    return;
  }

  const oldSlideElement = currentSlideElement;
  const unreadSlideElementsCount = countUnreadSlideElements();
  let numEntriesAppended = 0;
  let conn, name, version, connectTimeout;

  try {
    conn = await openReaderDb(name, version, connectTimeout, verbose);

    // Conditionally append more slides
    if(unreadSlideElementsCount < 2) {
      numEntriesAppended = await appendSlides(conn, verbose);
    }

    if(currentSlideElement.nextSibling) {
      currentSlideElement.style.left = '-100%';
      currentSlideElement.style.right = '100%';
      currentSlideElement.nextSibling.style.left = '0px';
      currentSlideElement.nextSibling.style.right = '0px';
      currentSlideElement.scrollTop = 0;
      currentSlideElement = currentSlideElement.nextSibling;

      // Change the active element to the new current slide, so that scrolling
      // with keys works
      currentSlideElement.focus();

      // Must be awaited to avoid error "DOMException: Failed to execute
      // 'transaction' on 'IDBDatabase': The database connection is closing."
      await markSlideRead(conn, oldSlideElement, verbose);
    }
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  if(numEntriesAppended > 0) {
    cleanupOlderSlides();
  }
}

function cleanupOlderSlides() {
  // Weakly assert as this error is trivial
  console.assert(currentSlideElement, 'currentSlideElement is undefined');

  const maxSlidesLoadedCount = 6;
  const containerElement = document.getElementById('slideshow-container');
  while(containerElement.childElementCount > maxSlidesLoadedCount &&
    containerElement.firstChild !== currentSlideElement) {
    removeSlide(containerElement.firstChild);
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

function countUnreadSlideElements() {
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

  let conn;// leave as undefined, appendSlides will auto connect
  const verbose = true; // Temporarily true for debugging
  appendSlides(conn, verbose);
}, {'once': true});

} // End file block scope
