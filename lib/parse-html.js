// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Parses an HTML string into an HTML element. For now
 * this parses into a new HTML document and returns
 * the body element.
 *
 * This does not use document.createElement. Webkit
 * fetches resources in a local document element the moment the
 * element is created, regardless of whether the element is later
 * appended to the document. Therefore, we create a separate
 * document using document.implementation.createHTMLDocument, and
 * then use the innerHTML trick on the body element.
 *
 * Appending an element created in a foreign document to the
 * local document should technically throw an exception. The proper
 * approach is to use document.importNode or document.adoptNode
 * to create an element within the local document context and
 * then append that element. However, Webkit/Chrome sometimes allows
 * for the import step to be implied when using appendChild or
 * replaceChild. Caveat implementor.
 *
 * NOTE: DOMParser.parseFromString in Webkit/Chrome just decorates
 * document.implementation.createDocument and passes in
 * some default parameters. The two approaches are basically the
 * same.
 *
 * NOTE: this uses doc.body simply because I did not realize at the time
 * I first wrote this that using doc.documentElement.innerHTML would
 * work just as well.
 *
 * NOTE: because this returns the body element, a simple way to get to
 * the containing document is by doc.body.ownerDocument
 */
function parseHTML(str) {
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;
  return doc.body;
}

/**
 * See http://www.html5rocks.com/en/tutorials/webcomponents/template/
 * Using a template approach could be better for several reasons.
 * Template HTML is inert until appended, unlike createElement. It still
 * uses what is basically the innerHTML hack. It gives us something
 * rootless so we do not have to mess with doc.body stuff. It also
 * significantly less heavyweight then creating a document. It looks
 * like it also requires adoptNode instead of doing it implicitly in
 * appendChild, which could reduce errors and XSS surprises.
 *
 * UNDER DEVELOPMENT, UNTESTED
 */
function parseHTML2(str) {
  var template = document.createElement('template');
  template.content = str;
  return template;
}


/**
 * Scrubs html from a string by parsing into HTML and then
 * back into text without element tags. Specifying a replacement is
 * slower because of non-native iteration.
 */
function stripTags(str, replacement) {
  if(!str) {
    return;
  }

  var htmlDocumentBody = parseHTML(str);

  if(replacement) {

    var ownerDocument = htmlDocumentBody.ownerDocument;
    var textNodeIterator = ownerDocument.createNodeIterator(
      htmlDocumentBody, NodeFilter.SHOW_TEXT);
    var textNode;
    var textNodes = [];

    while(textNode = textNodeIterator.nextNode()) {
      textNodes.push(textNode);
    }

    return textNodes.map(function(textNode) {
      return textNode.nodeValue;
    }).join(replacement);
  }

  return htmlDocumentBody.textContent;
}

/**
 * Simple regex approach to strip basic BR tags from string
 * This is not always accurate, just convenient.
 */
function stripBRs(str) {
  if(str) {
    return str.replace(/<br>/gi,'');
  }
}