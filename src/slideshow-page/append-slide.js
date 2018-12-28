import {filter_publisher} from '/src/slideshow-page/article-title.js';
import assert from '/src/assert.js';
import {escape_html} from '/src/slideshow-page/utils/escape-html.js';
import truncate_html from '/src/truncate-html.js';
import * as config from '/src/config.js';
import * as db from '/src/db/db.js';

import {hide_no_articles_message} from './no-articles-message.js';
import {slide_onclick} from './slide-onclick.js';
import * as slideshow_state from './slideshow-state.js';

// TODO: this should be relying on css-based truncation rather than calling
// truncate_html

// BUG: create_article_title_element is double encoding entities, so entities
// show up in the value. I partially fixed by not escaping ampersand but that's
// not the correct solution.

// TODO: the creation of a slide element, and the appending of a slide element,
// should be two separate tasks. This will increase flexibility and maybe
// clarity. append_slide should accept a slide element, not an entry. It is
// confusing that this function is named append_slide, but it accepts an entry,
// not a slide, which is just plain bad naming.

// TODO: the default duration should come from localStorage, and be stored
// in localStorage instead of maintained here in module scope, and should be
// accessed using config module io operations. Duration should be a configurable
// option customizable by the user, because slide animation speed can be a real
// tactile encumbrance


// Slide animation speed (smaller is faster). This is stored in module scope,
// and is modifiable after module load via an exported setter function.
let duration = 0.16;

export function append_slide(entry) {
  // Now that we know there will be at least one visible article, ensure the
  // no articles message is hidden
  hide_no_articles_message();

  const slide = create_slide(entry);
  attach_slide(slide);
}

function create_slide(entry) {
  assert(db.is_entry(entry));
  assert(Array.isArray(entry.urls));
  assert(entry.urls.length > 0);

  const slide = document.createElement('slide');
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class', 'entry');

  const slide_pad_wrap = document.createElement('div');
  slide_pad_wrap.className = 'slide-padding-wrapper';
  slide_pad_wrap.appendChild(create_article_title_element(entry));
  slide_pad_wrap.appendChild(create_article_content_element(entry));
  slide_pad_wrap.appendChild(create_feed_source_element(entry));
  slide.appendChild(slide_pad_wrap);
  return slide;
}


function create_article_title_element(entry) {
  const title_element = document.createElement('a');
  title_element.setAttribute('href', entry.urls[entry.urls.length - 1]);
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('rel', 'noreferrer');

  if (entry.title) {
    let title = entry.title;
    title = escape_html(title);
    title_element.setAttribute('title', title);

    // filter_publisher requires title be a string. we know it is a string here
    // so no need for extra sanity checks
    title = filter_publisher(title);

    const max_length = config.read_int('entry_title_max_length');
    if (!isNaN(max_length)) {
      title = truncate_html(title, max_length);
    }

    // Use innerHTML to allow entities
    title_element.innerHTML = title;
  } else {
    title_element.setAttribute('title', 'Untitled');
    title_element.textContent = 'Untitled';
  }

  return title_element;
}

function create_article_content_element(entry) {
  const content_element = document.createElement('span');
  content_element.setAttribute('class', 'entry-content');
  // <html><body> is implicitly stripped
  content_element.innerHTML = entry.content;
  return content_element;
}

function create_feed_source_element(entry) {
  const source_element = document.createElement('span');
  source_element.setAttribute('class', 'entry-source');

  if (entry.faviconURLString) {
    const favicon_element = document.createElement('img');
    favicon_element.setAttribute('src', entry.faviconURLString);
    favicon_element.setAttribute('width', '16');
    favicon_element.setAttribute('height', '16');
    source_element.appendChild(favicon_element);
  }

  const details = document.createElement('span');
  if (entry.feedLink) {
    details.setAttribute('title', entry.feedLink);
  }

  const buffer = [];
  buffer.push(entry.feedTitle || 'Unknown feed');
  buffer.push(' by ');
  buffer.push(entry.author || 'Unknown author');
  if (entry.datePublished) {
    buffer.push(' on ');
    buffer.push(format_date(entry.datePublished));
  }
  details.textContent = buffer.join('');
  source_element.appendChild(details);
  return source_element;
}

// TODO: this helper should probably be inlined into append_slide once I work
// out the API better. One of the main things I want to do is resolve the
// mismatch between the function name, append-slide, and its main parameter,
// a database entry object. I think the solution is to separate entry-to-element
// and append-element. This module should ultimately focus only on appending,
// not creation and coercion.
function attach_slide(slide) {
  const container = document.getElementById('slideshow-container');

  // Defer binding event listener until appending here, not earlier when
  // creating the element. We are not sure a slide will be used until it is
  // appended, and want to avoid attaching listeners to unused detached
  // elements.
  slide.addEventListener('click', slide_onclick);

  // In order for scrolling to react to keyboard shortcuts such as pressing
  // the down arrow key, the element must be focused, and in order to focus an
  // element, it must have the tabindex attribute.
  slide.setAttribute('tabindex', '-1');

  // Slides are positioned absolutely. Setting left to 100% places the slide off
  // the right side of the view. Setting left to 0 places the slide in the view.
  // The initial value must be defined here and not via css, before adding the
  // slide to the page. Otherwise, changing the style for the first slide causes
  // an unwanted transition, and I have to change the style for the first slide
  // because it is not set in css.
  slide.style.left = container.childElementCount === 0 ? '0' : '100%';

  // TODO: review if prefix was dropped

  // In order for scrolling a slide element with keyboard keys to work, the
  // slide must be focused. But calling element.focus() while a transition is
  // active, such as what happens when a slide is moved, interrupts the
  // transition. Therefore, schedule focus for when the transition completes.
  slide.addEventListener('webkitTransitionEnd', transition_onend);

  // The value of the duration variable is defined external to this function,
  // because it is mutable by other functions.

  // Define the animation effect that will occur when moving the slide. Slides
  // are moved by changing a slide's css left property. This triggers a
  // transition. The transition property must be defined dynamically in order to
  // have the transition only apply to a slide when it is in a certain state. If
  // set via css then this causes an undesirable immediate transition on the
  // first slide.
  slide.style.transition = `left ${duration}s ease-in-out`;

  // Initialize the current slide if needed
  if (!slideshow_state.get_current_slide()) {
    // TODO: is this right? I think it is because there is no transition for
    // first slide, so there is no focus call. But maybe not needed?
    slide.focus();
    slideshow_state.set_current_slide(slide);
  }

  container.appendChild(slide);
}

function is_valid_transition_duration(duration) {
  return !isNaN(duration) && isFinite(duration) && duration >= 0;
}

export function set_transition_duration(input_duration) {
  if (!is_valid_transition_duration(input_duration)) {
    throw new TypeError('Invalid duration parameter', input_duration);
  }

  duration = input_duration;
}

// Handle the end of a transaction. Should not be called directly.
function transition_onend(event) {
  // The slide that the transition occured upon (event.target) is not guaranteed
  // to be equal to the current slide. We want to affect the current slide.
  // We fire off two transitions per animation, one for the slide being moved
  // out of view, and one for the slide being moved into view. Both transitions
  // result in call to this listener, but we only want to call focus on one of
  // the two elements. We want to be in the state where after both transitions
  // complete, the new slide (which is the current slide at this point) is now
  // focused. Therefore we ignore event.target and directly affect the current
  // slide only.
  const slide = slideshow_state.get_current_slide();
  slide.focus();

  // There may be more than one transition effect occurring at the moment.
  // Inform others via global slideshow state that this transition completed.
  slideshow_state.decrement_active_transition_count();
}

// Return a date as a formatted string. This is an opinionated implementation
// that is intended to be very simple. This tries to recover from errors and
// not throw.
function format_date(date) {
  if (!(date instanceof Date)) {
    return 'Invalid date';
  }

  // When using native date parsing and encountering an error, rather than throw
  // that error, a date object is created with a NaN time property. Which would
  // be ok but the format call below then throws if the time property is NaN
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  // The try/catch is just paranoia for now. This previously threw when date
  // contained time NaN.
  const formatter = new Intl.DateTimeFormat();
  try {
    return formatter.format(date);
  } catch (error) {
    console.debug(error);
    return 'Invalid date';
  }
}
