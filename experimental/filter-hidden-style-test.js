import * as FetchUtils from '/src/fetch/fetch.js';
import {html_parse} from '/src/html/html.js';

window.test = async function(url) {
  const response = await FetchUtils.fetch_html(url);
  const text = await response.text();
  const doc = html_parse(text);
  filterUsingStyle(doc);
};

function filterUsingStyle(doc) {
  if (!doc.body) return;
  const elements = doc.body.querySelectorAll('*');
  const doc_element = doc.documentElement;
  for (const element of elements) {
    if (isHiddenByStyle(element) && doc_element.contains(element)) {
      console.debug('Removing', element.outerHTML);
      element.remove();
    }
  }
}

function isHiddenByOpacity(element) {
  try {
    return parseFloat(element.style.opacity) < 0.3;
  } catch (error) {
  }
}

function isHiddenByStyle(element) {
  const style = element.style;
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  return isHiddenByOpacity(element);
}
