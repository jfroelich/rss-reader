// See license.md

'use strict';

const jrTemplateHostMap = {};

jrTemplateHostMap['www.washingtonpost.com'] = [
  'header#wp-header',
  'div.top-sharebar-wrapper',
  'div.newsletter-inline-unit',
  'div.moat-trackable'
];

jrTemplateHostMap['theweek.com'] = ['div#head-wrap'];
jrTemplateHostMap['www.usnews.com'] = ['header.header'];

function jrTemplatePrune(urlString, documentObject) {
  let urlObject;

  try {
    urlObject = new URL(urlString);
  } catch(error) {
    return;
  }

  const selectorsArray = jrTemplateHostMap[urlObject.hostname];
  const selector = selectorsArray.join(',');
  const elementList = documentObject.querySelectorAll(selector);
  for(let element of elementList) {
    element.remove();
  }
}
