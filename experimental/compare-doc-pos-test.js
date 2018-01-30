
// Need to do a review of bitwise, 2s complement, and all that. Seems I have
// forgotten some of it.
function itoa(i) {
  return (i >>> 0).toString(2);
}


function test() {
  const a = document.getElementById('a');
  const b = document.getElementById('b');
  const c = document.getElementById('c');
  const d = document.getElementById('d');
  const e = document.getElementById('e');

  const maskab = a.compareDocumentPosition(b);

  console.log('maskab:', maskab, itoa(maskab));

  console.log(
      'a not connected to b?', itoa(Node.DOCUMENT_POSITION_DISCONNECTED),
      itoa(maskab & Node.DOCUMENT_POSITION_DISCONNECTED),
      maskab & Node.DOCUMENT_POSITION_DISCONNECTED);
  console.log(
      'a precedes b?', itoa(Node.DOCUMENT_POSITION_PRECEDING),
      itoa(maskab & Node.DOCUMENT_POSITION_PRECEDING),
      maskab & Node.DOCUMENT_POSITION_PRECEDING);
  console.log(
      'a follows b?', itoa(Node.DOCUMENT_POSITION_FOLLOWING),
      itoa(maskab & Node.DOCUMENT_POSITION_FOLLOWING),
      maskab & Node.DOCUMENT_POSITION_FOLLOWING);
  console.log(
      'a contains b?', itoa(Node.DOCUMENT_POSITION_CONTAINS),
      itoa(maskab & Node.DOCUMENT_POSITION_CONTAINS),
      maskab & Node.DOCUMENT_POSITION_CONTAINS);
  console.log(
      'a is contained by b?', itoa(Node.DOCUMENT_POSITION_CONTAINED_BY),
      itoa(maskab & Node.DOCUMENT_POSITION_CONTAINED_BY),
      maskab & Node.DOCUMENT_POSITION_CONTAINED_BY);
}

/*
// Remove elements that do not intersect with the best element
prune(doc, bestElement) {
  const docElement = doc.documentElement;
  if(bestElement === docElement)
    return;
  const elements = doc.body.querySelectorAll('*');
  for(let element of elements) {
    if(!element.contains(bestElement) &&
      !bestElement.contains(element) &&
      docElement.contains(element)) {
      element.remove();
    }
  }
}


DOCUMENT_POSITION_DISCONNECTED	1
DOCUMENT_POSITION_PRECEDING	2
DOCUMENT_POSITION_FOLLOWING	4
DOCUMENT_POSITION_CONTAINS	8
DOCUMENT_POSITION_CONTAINED_BY	16
DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC	32


const head = document.getElementsByTagName('head').item(0);

if (head.compareDocumentPosition(document.body) &
  Node.DOCUMENT_POSITION_FOLLOWING) {
  console.log("well-formed document");
} else {
  console.log("<head> is not before <body>");
}


*/
