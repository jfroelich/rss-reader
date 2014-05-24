function addPrefetchLink(url) {
  var link = document.createElement('link');
  link.setAttribute('rel','prefetch');
  link.setAttribute('href', url);
  var head = document.documentElement.firstChild;
  head.appendChild(link);
}
