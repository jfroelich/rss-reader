
'use strict';

function filterHiddenElements(doc) {
  if(!doc.body)
    return;
  const els = doc.body.querySelectorAll('*');
  const rootElement = doc.documentElement;
  for(let el of els) {
    if(isHiddenElement(el) && rootElement.contains(el)) {
      // console.debug('Removing', el.outerHTML);
      el.remove();
    }
  }
}

function isHiddenElement(el) {
  const style = el.style;
  if(style.display === 'none' || style.visibility === 'hidden')
    return true;
  let opacityFloat = 1.0;
  const opacityString = style.opacity;
  if(opacityString) {
    try {
      opacityFloat = parseFloat(opacityFloat);
    } catch(error) {
      console.warn(error);
    }
  }

  return opacityFloat < 0.3;
}

async function test(url) {
  const options = {
    'credentials': 'omit',
    'method': 'get',
    'headers': {'accept': 'text/html'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer',
    'referrerPolicy': 'no-referrer'
  };

  let doc;
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    doc = (new DOMParser()).parseFromString(text, 'text/html');
  } catch(error) {
    console.warn(error);
  }

  if(!doc)
    return;

  filterHiddenElements(doc);
}
