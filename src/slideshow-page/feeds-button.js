// TODO: move to main-menu.js
// TODO: clarify by renaming to something like view_feeds_button_onclick

export function feeds_button_onclick(event) {
  const feeds_button = document.getElementById('feeds-button');
  feeds_button.disabled = true;

  const reader_button = document.getElementById('reader-button');
  reader_button.disabled = false;

  const slideshow_container = document.getElementById('slideshow-container');
  slideshow_container.style.display = 'none';

  const feeds_container = document.getElementById('feeds-container');
  feeds_container.style.display = 'block';
}
