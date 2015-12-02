

document.addEventListener('DOMContentLoaded', function() {
  'use strict';
  console.log('Loaded');

  // Ok, now this is working
  // I was originally testing with <p>, it turns out that
  // Chrome does very strange things when nesting <p> within <p>,
  // it decides to start a new p upon seeing a nested p, without
  // checking for the closing tag. So that is a separate issue
  // to investigate.

  // Anyway, the point is, removing while iterating over getElementsByTagName
  // is completely screwed up and doesn't even remove everything
  // Removing in reverse works, but it works on every single node in the
  // list, even after it was adopted, even when checking ownerDocument
  // So, the only way to get it to work is to use querySelectorAll combined
  // with adoptNode, or to use NodeIterator


  var foreign = document.implementation.createHTMLDocument();

  console.log('foreign === document? ', foreign === document);

  const elements = document.body.querySelectorAll('*');
  var numElements = elements.length;
  var element = null;

  console.log('Found %s elements to remove', numElements);

  for(var i = 0; i < numElements; i++) {
    element = elements[i];

    if(element.ownerDocument === document) {
      console.log('Removing ',i, element.ownerDocument === document,
        element.id, element.outerHTML);
      //element.remove();

      // NOTE: adoptNode does not appear to be moving the subtree
      foreign.adoptNode(element);
    } else if(element) {
      console.log('Skipping foreign', i);
    } else {
      console.log('Skipping undefined', i);
    }
  }
});
