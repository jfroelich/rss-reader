import * as FetchUtils from "/src/common/fetch-utils.js";
import {parseHTML} from "/src/common/html-utils.js";

async function test(url) {
  const response = await FetchUtils.fetchHTML(url);
  const text = await response.text();
  const doc = parseHTML(text);
  filter_hidden_elements_using_style(doc);
}

function filter_hidden_elements_using_style(doc) {
  if(!doc.body)
    return;
  const elements = doc.body.querySelectorAll('*');
  const doc_element = doc.documentElement;
  for(const element of elements) {
    if(is_hidden_element_using_style(element) &&
      doc_element.contains(element)) {
      console.debug('Removing', element.outerHTML);
      element.remove();
    }
  }
}

function is_hidden_element_using_style_opacity(element) {
  try {
    return parseFloat(element.style.opacity) < 0.3;
  } catch(error) {}
}

function is_hidden_element_using_style(element) {
  const style = element.style;
  if(style.display === 'none' || style.visibility === 'hidden')
    return true;
  return is_hidden_element_using_style_opacity(element);
}

window.test = test;
