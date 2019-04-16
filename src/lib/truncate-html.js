const ELLIPSIS = '\u2026';

// TODO: recouple with parseHTML

export default function truncateHTML(htmlString, position, suffix = ELLIPSIS) {
  if (!Number.isInteger(position)) {
    throw new TypeError('position must be an integer');
  }

  if (position < 0) {
    throw new TypeError('position must be greater than or equal to 0');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const parserErrorElement = doc.querySelector('parsererror');
  if (parserErrorElement) {
    return '<html><body>Unsafe or malformed HTML</body></html>';
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  let totalLength = 0;

  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const valueLength = value.length;
    if (totalLength + valueLength >= position) {
      const remainingLength = position - totalLength;
      node.nodeValue = value.substr(0, remainingLength) + suffix;
      break;
    } else {
      totalLength += valueLength;
    }
  }

  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }

  if (/<html/i.test(htmlString)) {
    return doc.documentElement.outerHTML;
  }
  return doc.body.innerHTML;
}
