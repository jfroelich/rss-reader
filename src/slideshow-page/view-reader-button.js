// TODO: rename func after file

export function reader_button_onclick(event) {
  const feeds_button = document.getElementById('feeds-button');
  feeds_button.disabled = false;

  const reader_button = document.getElementById('reader-button');
  reader_button.disabled = true;

  const slideshow_container = document.getElementById('slideshow-container');
  slideshow_container.style.display = 'block';

  const feeds_container = document.getElementById('feeds-container');
  feeds_container.style.display = 'none';
}
