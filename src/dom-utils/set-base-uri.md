# set_base_uri
Set the baseURI property of a document. `document.baseURI` is readonly. However, the property's value is derived from base elements. Base elements are modifiable. Therefore baseURI is indirectly modifiable by affecting base elements.

The problem being solved is that a document may need to be made embeddable in another document, such as in a web-based view that displays documents. Another use case is that various processing tools need to know a document's base url. It is annoying to pass around two values, a document and a URL, to every function that processes a document and needs to also know its base url. It seems better to use a single value, the document, and treat the base url as a property of that document. It decreases the chance of mistakenly associating the wrong url with the wrong document.

However, rather than trying to use an expand-object property where the code stuffs some non-standard property into instances of the built-in `Document` object, this attempts to use the more correct method for carrying out the base url along with the document instance, which is to customize the document such that its `document.baseURI` reports the correct value.

There are problems with this approach. One of the reasons this solution is brittle is because it inserts the property by changing the content of the document. This means that all other document transforms must share the concern of maintaining the base uri, or the soundness of the output of this operation can be undone by surprise. For example, you could call this operation, then another transformation, and then find out by surprise that this operation was ineffectual, even though prior to calling the other transformation it was effectual.

This imposes a canonical requirement on the input url. After this operation the document will have a canonical base url that is standalone, free of dependency on any kind of inherited/substituted base url that comes from somewhere else.

## Spec information
https://html.spec.whatwg.org/multipage/semantics.html#the-base-element

## Params
* @param document {Document} the document to modify. Due to the prohibitive cost of copying document objects, the document input is modified in place rather than treated as immutable.
* @param url {URL} the desired base url to use, which depending on params and the document, will either be ignored, merged with existing base, or will replace the existing base.
* @param overwrite {Boolean} if true, then existing bases are ignored, and the base uri is set to the input url. If false, then existing bases are respected. Defaults to false. Note that in both cases, all bases other than the intended base element are implicitly removed.
* @return {void}

## Live vs inert concern
This is written so as to minimize the difference in performance when working on live versus inert document state. When this inserts a hierarchy of elements, it builds the
full hierarchy in a detached context before attaching the root of the hierarchy.

## Security notes regarding XSS prevention
This implementation uses `document.createElement`. The `set_base_uri` function takes care to create the element as owned by the input document, which should not be the same document as the document running this script. Because the identifier `document` is a global variable and this uses a function parameter named `document`, there is some ambiguity. So I want to be very clear here. When this accesses `document`, it is accessing the local variable, not the global.

## TODOs
* regarding testing, the set-base-uri test is slightly out of date due to recent changes to set-base-uri. Need to take into account the new overwrite parameter, and need to take into account the clarified behavior on following the one-base-per-document rule.
* when testing, test 'missing a head element' basic case?
* when testing, test for multiple existing bases? when multiple, first one with href should be the one used
