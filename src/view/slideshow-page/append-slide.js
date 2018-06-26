import * as config from '/src/config.js';
import * as array from '/src/lib/array.js';
import * as html from '/src/lib/html.js';
import {filter_publisher} from '/src/lib/nlp.js';
import * as Model from '/src/model.js';
import {hide_no_articles_message} from '/src/view/slideshow-page/no-articles-message.js';
import {slide_onclick} from '/src/view/slideshow-page/slide-onclick.js';
import * as slideshow_state from '/src/view/slideshow-page/slideshow-state.js';

// TODO: use assert?
// TODO: simplify logging messages now that wrapper no longer in use

let duration = 0.25;

export function append_slide(entry) {
  if (!Model.is_entry(entry)) {
    console.warn('%s: invalid entry parameter', append_slide.name, entry);
    return;
  }

  if (array.is_empty(entry.urls)) {
    console.warn('%s: skipping entry without url', append_slide.name, entry);
    return;
  }

  // Now that we know there will be at least one visible article, ensure the
  // no articles message is hidden
  hide_no_articles_message();

  const slide = create_slide(entry);
  append_slide_element(slide);
}

function create_slide(entry) {
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


// BUG: this is double encoding entities somehow, so entities show up in the
// value. I partially fixed by not escaping ampersand but that's not right.
function create_article_title_element(entry) {
  const title_element = document.createElement('a');
  title_element.setAttribute('href', array.peek(entry.urls));
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('rel', 'noreferrer');

  if (entry.title) {
    let title = entry.title;
    title = html.escape_html(title);
    title_element.setAttribute('title', title);

    title = filter_publisher(title);

    const max_length = config.read_int('entry_title_max_length');
    if (!isNaN(max_length)) {
      title = html.truncate_html(title, max_length);
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

function append_slide_element(slide) {
  const container = document.getElementById('slideshow-container');

  // Defer binding event listener until appending here, not earlier when
  // creating the element
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
  // set in css then this causes an undesirable immediate transition on the
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

// Handle the end of a transaction. Not meant to be called directly.
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
  slideshow_state.get_current_slide().focus();

  // There may be more than one transition effect occurring at the moment.
  // Inform others via global slideshow state that this transition completed.
  slideshow_state.decrement_active_transition_count();
}

// Return a date as a formatted string. This is an opinionated implementation
// that is intended to be very simple
function format_date(date) {
  if (!(date instanceof Date)) {
    return 'Invalid date';
  }

  // When using native date parsing and encountering an error, rather than throw
  // that error, a date object is created with a NaN time property.
  //
  // Which would be ok but the format call below then throws if the time
  // property is NaN

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
