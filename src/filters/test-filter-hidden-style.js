
window.test = test;

async function test(url) {

  // TODO: use fetchHTML instead of raw fetch. This was created before fetch-html.js was settled

  const options = {
    credentials: 'omit',
    method: 'get',
    headers: {'accept': mime.MIME_TYPE_HTML},
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  const response = await fetch(url, options);
  const text = await response.text();

  // TODO: use /src/html/parse.js
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, mime.MIME_TYPE_HTML);
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
