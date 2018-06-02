import {is_entry} from '/src/entry.js';
import {filter_publisher} from '/src/lib/filter-publisher.js';
import {escape_html} from '/src/lib/html/escape-html.js';
import {truncate_html} from '/src/lib/html/truncate-html.js';
import {format_date} from '/src/lib/lang/format-date.js';
import {list_peek} from '/src/lib/lang/list.js';
import {log, warn} from '/src/log.js';
import {slide_onclick} from '/src/slideshow-page/slide-onclick.js';
import {get_current_slide, set_current_slide} from '/src/slideshow-page/slideshow-state.js';
import {transition_onend} from '/src/slideshow-page/slideshow.js';

// TODO: the cursor stuff probably will not work

// TODO: review and fix imports

// TODO: the creation of a slide element, and the appending of a slide element,
// should be two separate tasks. This will increase flexibility and maybe
// clarity. append_slide should accept a slide element, not an entry.

// TODO: duration should come from localStorage?

let duration = 0.35;


export function append_slide(entry) {
  if (!is_entry(entry)) {
    warn('%s: invalid entry parameter', append_slide.name, entry);
    return;
  }

  log('%s: entry', append_slide.name, list_peek(entry.urls));

  const slide = create_slide_element();
  slide.setAttribute('entry', entry.id);
  slide.setAttribute('feed', entry.feed);
  slide.setAttribute('class', 'entry');
  slide.addEventListener('click', slide_onclick);

  const slide_pad_wrap = document.createElement('div');
  slide_pad_wrap.className = 'slide-padding-wrapper';
  slide_pad_wrap.appendChild(create_article_title_element(entry));
  slide_pad_wrap.appendChild(create_article_content_element(entry));
  slide_pad_wrap.appendChild(create_feed_source_element(entry));
  slide.appendChild(slide_pad_wrap);

  append_slide_element(slide);
}


// BUG: this is double encoding entities somehow, so entities show up in the
// value. I partially fixed by not escaping ampersand but that's not right.
function create_article_title_element(entry) {
  const title_element = document.createElement('a');
  title_element.setAttribute('href', list_peek(entry.urls));
  title_element.setAttribute('class', 'entry-title');
  title_element.setAttribute('rel', 'noreferrer');

  if (entry.title) {
    let title = entry.title;
    let safe_title = escape_html(title);
    title_element.setAttribute('title', safe_title);

    let filtered_safe_title = filter_publisher(safe_title);

    // TODO: does truncate_html throw in the usual case? I believe it should not
    // but I forgot. I would like to remove this try/catch
    try {
      filtered_safe_title = truncate_html(filtered_safe_title, 300);
    } catch (error) {
      log(error);
    }

    // Allow entities
    title_element.innerHTML = filtered_safe_title;

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

export function create_slide_element() {
  return document.createElement('slide');
}

function append_slide_element(slide) {
  const container = document.getElementById('slideshow-container');


  // Caller handles slide clicks
  // slide.addEventListener('click', onClick);

  // Setup side scroll handling. The listener is bound to the slide itself,
  // because it is the slide itself that scrolls, and not window. Also, in order
  // for scrolling to react to keyboard shortcuts, the element must be focused,
  // and in order to focus an element, it must have the tabindex attribute.
  slide.setAttribute('tabindex', '-1');

  // Set the position of the slide. Slides are positioned absolutely. Setting
  // left to 100% places the slide off the right side of the view. Setting left
  // to 0 places the slide in the view. The initial value must be defined here
  // and not via css, before adding the slide to the page. Otherwise, changing
  // the style for the first slide causes an unwanted transition, and I have to
  // change the style for the first slide because it is not set in css.
  slide.style.left = container.childElementCount === 0 ? '0' : '100%';

  // In order for scrolling a slide element with keyboard keys to work, the
  // slide must be focused. But calling element.focus() while a transition is
  // active, such as what happens when a slide is moved, interrupts the
  // transition. Therefore, schedule a call to focus the slide for when the
  // transition completes.
  slide.addEventListener('webkitTransitionEnd', transition_onend);

  // Define the animation effect that will occur when moving the slide. Slides
  // are moved by changing a slide's css left property, which is basically its
  // offset from the left side of window. This will also trigger a transition
  // event. The transition property must be defined here in code, and not via
  // css, in order to have the transition only apply to a slide when it is in a
  // certain state. If set in css then this causes an immediate transition on
  // the first slide, which I want to avoid.
  slide.style.transition = `left ${duration}s ease-in-out`;

  // Initialize the current slide if needed
  if (!get_current_slide()) {
    // TODO: is this right? I think it is because there is no transition for
    // first slide, so there is no focus call. But maybe not needed?
    slide.focus();

    set_current_slide(slide);
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
