/**
 * Convert an XMLDocument representing a feed into a feed object.
 *
 * Throws an error if xmlDocument is undefined, or if xmlDocument.documentElement
 * is undefined, or if the document is not one of the supported types.
 */
function createFeedFromDocument(xmlDocument) {

  if(!xmlDocument) {
    throw new TypeError('undefined document');
  }

  var documentElement = xmlDocument.documentElement;

  if(!documentElement) {
    throw new TypeError('undefined document element');
  }

  var isRSS = documentElement.matches('rss');
  var isAtom = documentElement.matches('feed');
  var isRDF = documentElement.matches('rdf');

  var isDocumentTypeSupported = isRSS || isAtom || isRDF;

  if(!isDocumentTypeSupported) {
    throw new TypeError('unsupported document type ' + documentElement.localName);
  }

  var result = {};
  var forEach = Array.prototype.forEach;

  // Grab the feed properties and then grab the entry properties
  // Only set properties of the result object if there is a value.

  var feedTitleText = getElementTextOrAttribute(documentElement,
    isAtom ? ['feed title'] : ['channel title']);
  if(feedTitleText) {
    result.title = feedTitleText;
  }

  var feedDescriptionText = getElementTextOrAttribute(documentElement,
    isAtom ? ['feed subtitle'] : ['channel description']);
  if(feedDescriptionText) {
    result.description = feedDescriptionText;
  }

  var feedLinkSelectors, feedLinkText;
  if(isAtom) {
    feedLinkSelectors = ['feed link[rel="alternate"]', 'feed link[rel="self"]', 'feed link'];
    feedLinkText = getElementTextOrAttribute(documentElement, feedLinkSelectors, 'href');
    if(feedLinkText) {
      result.link = feedLinkText;
    }
  } else {
    // Prefer the textContent of a link element that does not have an href
    feedLinkText = getElementTextOrAttribute(documentElement, ['channel link:not([href])']);
    if(feedLinkText) {
      result.link = feedLinkText;
    } else {
      // Fall back to href attribute value for any link
      feedLinkText = getElementTextOrAttribute(documentElement, ['channel link'], 'href');
      if(feedLinkText) {
        result.link = feedLinkText;
      }
    }
  }

  // Set feed date (pubdate or similar, for entire feed)
  var feedDateSelectors = isAtom ? ['feed updated'] :
    (isRSS ? ['channel pubdate','channel lastBuildDate','channel date'] : ['channel date']);
  var feedDateText = getElementTextOrAttribute(documentElement, feedDateSelectors);
  if(feedDateText) {
    result.date = feedDateText;
  }

  // Process entry elements
  result.entries = [];

  // I cannot remember why I treat RDF differently than RSS but I think it was
  // because RDF feeds were not nesting items in channel
  var entryElementSelector = isAtom ? 'feed entry' : isRSS ? 'channel item' : 'item';
  var entryElements = documentElement.querySelectorAll(entryElementSelector);

  forEach.call(entryElements, function(entryElement) {
    var entryResult = {};

    var entryTitleText = getElementTextOrAttribute(entryElement, ['title']);
    if(entryTitleText) {
      entryResult.title = entryTitleText;
    }

    var entryLinkText = isAtom ?  getElementTextOrAttribute(entryElement,
      ['link[rel="alternate"]','link[rel="self"]','link[href]'], 'href') :
      getElementTextOrAttribute(entryElement, ['origLink','link']);
    if(entryLinkText) {
      entryResult.link = entryLinkText;
    }

    var entryAuthorText = isAtom ? getElementTextOrAttribute(entryElement, ['author name']) :
      getElementTextOrAttribute(entryElement, ['creator','publisher']);
    if(entryAuthorText) {
      entryResult.author = entryAuthorText;
    }

    var entryPubDateText = getElementTextOrAttribute(entryElement,
      isAtom ? ['published','updated'] : (isRSS ? ['pubDate'] : ['date']));
    if(entryPubDateText) {
      entryResult.pubdate = entryPubDateText;
    }

    var entryContentText = isAtom ?  getTextContentForAtomEntry(entryElement) :
      getElementTextOrAttribute(entryElement,['encoded','description','summary']);
    if(entryContentText) {
      entryResult.content = entryContentText;
    }

    result.entries.push(entryResult);
  });

  return result;
}

/**
 * I ran into weirdness for atom feed entry content, hence the more
 * detailed handling of this situation.
 *
 * I am sure a cleaner solution exists or I am missing something basic.
 * However, this at least for now gives the desired result.
 */
function getTextContentForAtomEntry(entryElement) {

  var forEach = Array.prototype.forEach;
  var contentElement = entryElement.querySelector('content');
  var text;

  if(contentElement) {

    var contentParts = [];

    // Serialize element content differently than text content
    forEach.call(contentElement.childNodes, function(atomContentNode) {
      if(atomContentNode.nodeType == Node.ELEMENT_NODE) {
        contentParts.push(atomContentNode.innerHTML);
      } else if(atomContentNode.nodeType == Node.TEXT_NODE) {
        contentParts.push(atomContentNode.textContent);
      } else if(atomContentNode.nodeType == Node.CDATA_SECTION_NODE) {
        contentParts.push(atomContentNode.textContent);
      }
    });

    text = contentParts.join('').trim();

    // A last ditch effort, may produce garbage or even be
    // redundant with above
    if(!text) {
      text = contentElement.textContent || '';
      text = text.trim();
    }
  }

  return text;
}

/**
 * Gets the textContent of a specific element or the value of a specific
 * attribute in the element. The value of the attribute is used if an
 * attribute is specified. Returns undefined if nothing matches or
 * the value for any that did match was empty.
 *
 * Reasons why this function is useful:
 *
 * First, searching for a comma separated list of selectors works in document
 * order, regardless of the order of the selectors. By using an array
 * of separate selectors, we can prioritize selector order over
 * document order, which is preferable for feed xml handling.
 *
 * Second, we sometimes want to get the value of an attribute instead of
 * the text content. Searching for the attribute involves nearly all the
 * same steps as searching for the element.
 *
 * Third, we want to only consider non-empty values as matching.
 * querySelectorAll stops once the element matches, and does not let
 * us compose additional concise and exact conditions on the textContent
 * value or attribute value. So this function enables us to fallback to later
 * selectors by merging in the non-empty-after-trimming condition.
 *
 * Fourth, we want short circuiting. querySelectorAll walks the entire
 * document every time, which is a waste.
 */
function getElementTextOrAttribute(rootElement, selectors, attribute) {

  // Which value is accessed is loop invariant.
  var accessText = attribute ? function fromAttribute(element) {
    return element.getAttribute(attribute);
  } : function fromTextContent(element) {
    return element.textContent;
  };

  // NOTE: using a raw loop because nothing in the native iteration API
  // fits because of the need to use side effects and the need short
  // circuit

  for(var i = 0, temp; i < selectors.length; i++) {
    temp = rootElement.querySelector(selectors[i]);
    if(!temp) continue;
    temp = accessText(temp);
    if(!temp) continue;
    temp = temp.trim();
    if(!temp) continue;
    return temp;
  }
}