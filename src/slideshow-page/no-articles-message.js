const element = document.getElementById('no-entries-message');

export function show_no_articles_message() {
  element.style.display = 'block';
}

export function hide_no_articles_message() {
  element.style.display = 'none';
}
