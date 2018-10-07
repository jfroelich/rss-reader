# condense-tagnames-filter

## What does this filter do?
Replace certain elements with alternative elements that have names with fewer characters. This helps reduce the number of characters in the document content when serialized into an html string.

## Rationale
The cost of persisting a large amount of html is greater than the cost of doing additional document processing when a document is in memory. This code takes place in a browser framework that uses indexedDB, and while the policy is unlimited storage, there is always the risk of storing too much, so the goal is to save space. Also, at this point, document processing speed seems reasonable so there is room to run less vital filters. Out of all the filters that might be applied to the document this one is relatively simple and unimportant.

## Other thoughts
* All the issues with using element coercion apply to this function, such as loss of event listeners
* This processes the document in place rather than returning a copy and staying pure because creating a copy of the document for each filter is cost prohibitive, and because the caller can create a copy if they want.
* The list of tags currently renamed is not exhaustive. There may be other creative ways to reduce space.
* This filter is completely naive regarding what other filters have been applied to the document in the past or will be applied in the future. There may be wasted work done. For example, the filter that reduces overuse of emphasis may nullify much of this effort.
* This filter does not affect document structure that much in comparison to other filters that remove elements entirely, so it should probably be located later in the sequence of applied filters, so as to minimize the amount of elements it considers.
* Analysis is restricted to tags within the body element. Given html soup and the high variance is browser behavior, the behavior of this filter on tags located outside of the body element is undefined.
* This pays no attention to imperfect situations that arise as a result of the transformations. For example, if input is strong then b, and strong is renamed to b, this leads to b b, which ideally would be one b, but this leaves it as two.
* This filter pays no attention to css issues that arise as a result of the transformations. For example, a css rule that applies to strong elements will stop working as desired because all strong elements are replaced with b elements.

## Params
* document {Document}
* copy_attrs_flag {Boolean} optional, if true then copy attributes, defaults to false, but note that this calls coerce-element with the flag, which defaults to true, so effectively this defaults to true, but keep in mind the behavior of that other module may change and this documentation may not be updated

## Errors
* {Error} if document is not a document.

## Implementation notes
This series of applications of coerce-element could be instead implemented as a loop over a map of element names, but I decided not to do so because I have mixed feelings. I am concerned about future extensibility. There may be some abnormal transforms that need to be applied to other elements. I am not sure why I am agonizing over this particularly bland detail.

Note that this uses querySelectorAll over getElementsByTagName because of how much simpler it is to iterate forward over the collection and perform mutations during iteration. I get to use for-of, which is terse and convenient. coerce_element implicitly does things like remove and create elements in the dom tree, and this totally screws up the 'static' nature of getElementsByTagName. I am not even sure if querySelectorAll is much slower than getElementsByTagName because the relative performance of each seems to change in every browser version increment.

## Todos
* read about the rationale behind why they added &lt;strong> when &lt;b> sufficed. I kind of want a clear explanation. My guess is that strong is clearer on its face, at first glance, than b.
* implement condense-tagnames-filter-test.js
* think of what other tags can be shorted, e.g. maybe layer to div?
* review https://blog.usejournal.com/of-svg-minification-and-gzip-21cd26a5d007 and consider whether this actually hurts compression within indexedDB
