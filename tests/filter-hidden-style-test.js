import * as FetchUtils from "/src/common/fetch-utils.js";
import {parseHTML} from "/src/common/html-utils.js";
import * as Status from "/src/common/status.js";

window.test = async function(url) {
  const response = await FetchUtils.fetchHTML(url);
  const text = await response.text();
  const doc = parseHTML(text);
  filterUsingStyle(doc);
};

function filterUsingStyle(doc) {
  if(!doc.body)
    return;
  const elements = doc.body.querySelectorAll('*');
  const doc_element = doc.documentElement;
  for(const element of elements) {
    if(isHiddenByStyle(element) &&
      doc_element.contains(element)) {
      console.debug('Removing', element.outerHTML);
      element.remove();
    }
  }
}

function isHiddenByOpacity(element) {
  try {
    return parseFloat(element.style.opacity) < 0.3;
  } catch(error) {}
}

function isHiddenByStyle(element) {
  const style = element.style;
  if(style.display === 'none' || style.visibility === 'hidden')
    return true;
  return isHiddenByOpacity(element);
}
