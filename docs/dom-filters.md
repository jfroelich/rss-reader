# anchor-format-filter
Removes anchor elements that play a formatting role instead of a functional inter-linking role. Essentially, any anchor that is missing an href attribute is non-functional and is presumed to be used for some other purpose.

When rendering a document in an embedded context where several pieces of information have been removed, the roles of various elements change, such that there is no longer a need to retain some elements, because after applying a series of other filters, those elements devolve in meaning into basic containers. Kind of like a useless span. In that sense, this filter is essentially just a special case of the set of filters that are concerned with removing useless elements. I special-cased this pass over the content because of the peculiarity regarding anchor href values.

Watch out for filter order when using this filter in combination with other filters that affect href values. For example, the filter that removes anchors that contain the javascript: protocol in the href attribute value. If that other filter is designed to only empty out the href value or remove the attribute but retain the element, then filter order matters, and this filter should occur after that filter.

## Params
* document {Document} the document to mutate


# anchor-script-filter
This filter removes certain anchor elements that appear to be *script-related*. An anchor is deemed script-related if, for example, if has an HREF attribute value that contains the JavaScript protocol.

Elements with onclick attributes, or similar attributes that a script-related, are not deemed script-related for purposes of this filter, despite there being an obvious similarity. Those other attributes are assumed to be handled by some other filter, such as one that removes all attributes that are not in a list of allowed attributes.

## Why filter script-related anchors?
The primary reason to use this filter is because script-related anchors will not work as expected when the document is displayed in an embedded context in the UI.

Script is mostly disabled in the UI. Another filter removes script elements. Often the case is that those script elements may create script objects that these javascript-related anchors then reference. Removing the script but not these anchors would lead to the anchor click causing a javascript-related error.

While it is not guaranteed that the other filter that removes script elements is always called together with this filter (in any order), this filter makes the assumption that the other filter is probably in use. I admit here the concerns are linked and this decoupling of the two filters might be wrong. However, there are concerns of this filter not related to the concerns of the script filter that still must be addressed.

It would be misleading to retain these anchors and have them no longer work. It is discordant to click on something and perceive no visible effect.

It would be very insecure to allow the user to cause a trusted click event on an anchor element that comes from an untrusted third party, which basically would be the extension misleading the browser running the extension.

## Anchors are unwrapped instead of removed
There is an important difference between removing an anchor element and unwrapping an anchor element. Removing the element removes both the element and its descendants. Unwrapping the element removes the element but retains its descendants, by approximately replacing the element with its descendants.

Various anchors found in content, even if they are JavaScript-related, may still contain informative content. Informative content should not be removed by some filter unintentionally. This filter should not remove informative content. Therefore, this filter unwraps anchors instead of naively removing them.

## Ripple effects
This is not concerned with ripple effects of removing content, such as the result of adjacent text nodes, the visible decrease in whitespace delimiting displayed content, etc. Some of this concern is addressed by how unwrap is implemented, but there can be other side effects.

## Filter ordering and other filters
* This should occur before filters that modify or remove attributes.
* This should occur after boilerplate analysis, because the ratio of anchor to non-anchor text is one of the boilerplate analysis features
* This is separate from the filter that removes formatting-related anchors, because I decided this is a separate concern.

## Errors
* {Error} if document is undefined or not a {Document}

## Return value
Void

## Todo
* Is there a way to write a CSS selector that imposes a minimum length requirement on an attribute value? This would helpfully reduce the number of anchors matched and move more processing to native. Using a minimum length check would not run into the same problems that a starts-with style check encounters (which is why this does not use starts-with).
* If the selector guarantees the attribute is present, then is the href attribute value guaranteed defined? Such as for &lt;a href&gt;foo&lt;/a&gt;? If so, then there is no need for the href boolean condition here. It will be implicit in the length test.

# color-contrast-filter
The color contrast filter removes text nodes with a text-color to background-color contrast ratio that is less than or equal to a minimum contrast ratio. The filter scans the content of an html document and looks at each element and makes a determination as to whether an element is difficult to perceive. The assumption is that an author of an article tends to make important text readily perceptible. If any element is faint, then it is a sign of a malicious SEO optimization, where the author wanted to include text visible to search engine bots but not visible to the typical browser user. The content of that element is undesirable and should be filtered.

While I would prefer to design a pure function that returns a new document, that is too heavyweight. Therefore this function mutates the input document in-place in an irreversible, lossy manner.

This filter is naïve for several reasons:

* The filter has no knowledge of what other filters have been applied, or will be applied. There could be redundant work being done, elements repeatedly analyzed in similar ways, or pointless work like the analysis of an element that will eventually be removed by another filter.
* This filter ignores other aspects of whether content is visible, such as elements with css `display:none`. I decided that element visibility is the concern of some other filter. It is worth the cost of having multiple passes over the content (if that is even much of a cost) so as to separate concerns of different filters.
* The filter naively analyzes every text node, including ones that are basically whitespace and therefore unimportant. A future design could prioritize performance and avoid analysis of certain basic elements.
* The filter uses an approximation when determining colors because it is not possible to know color without doing a full composite pass, which is prohibitively expensive and error-prone, it is difficult to maintain fidelity to browser rendering, it basically means recreating the entire compositor code which feels like a truly dumb idea, and because the accuracy difference is marginal. There are other similar issues. For example, this ignores average monitor brightness. This ignores rounding errors that result in loss of precision of color components. I am not even entirely sure I implemented the color code correctly. I would rather error on the side of conservative filtering.

The filter is restricted to enumerating text nodes within body content, because nodes outside of body are presumed hidden, and because it is unclear and inconsistent how browsers treat text nodes located outside of the body. Browsers tolerate malformed html and may include text nodes outside of body within the body, so this is not guaranteed to mirror browser behavior. However, the analysis may consider ancestor elements outside of the body element during alpha-blending.

This filter has no knowledge of image backgrounds and the numerous other ways that content is rendered such as negative margins, non-rectangular shaped elements, inverted z-indices, custom blend modes, etc. Again, this is an extremely naïve approximation. This views the content as a simple hierarchy of overlapping colored boxes, with text leaves, with most of the boxes being transparent, and imputes a default white background with default black text for missing values.

This filter completely ignores dynamic html. The document is analyzed in phase 0, the time the document is loaded, before animations occur. For example, content that begins at low contrast but is animated over time using JavaScript to become high contrast, is only observed at the time it is low contrast (and therefore is filtered).

This currently scans text nodes in document order, removing nodes as the iterator advances. The iterator is smart enough to deal with mutation during iteration. I do not currently know of a better way to iterate text nodes.

I decided to scan text nodes, as opposed to all elements, because those are really the only data points we are concerned with. There isn't much value in filtering other elements, because removing them does not generate value. If someone overlaps an empty block with the same color as the block underneath it, then the filter just ignores it.

I read somewhere that the reason analyzing contrast is so difficult, and the reason there is no built in eye-dropper-style api call that just gives us an element's color, is due to security concerns over being able to see user passwords. I eventually want to look into that more.

## About the default minimum contrast ratio
// Elements with contrast ratios below this threshold are not perceptible. I use
// a default value that is lower than the recommendation of 4.5, but
// distinguishes red/green better. It screws up dark gray on black. The
// difference in contrast ratios is basically because I am making unreliable
// approximations and because the immediate audience is a content-filter, not a
// person.

## Params
// * document {Document}
// * matte {Number} optional, the base color to use for composition
// * min_contrast_ratio {Number} optional, the minimum contrast above which
// content is perceptible

## Todos
* think about an annotation mode for testing. removing low contrast nodes makes it difficult to reason about what was removed. if instead this annotated, then it would be simple to preview the filter's decisions on every node.

# condense-tagnames-filter

## What does this filter do?
Replace certain elements with alternative elements that have names with fewer characters. This helps reduce the number of characters in the document content when serialized into an html string.

## Rationale
The cost of persisting a large amount of html is greater than the cost of doing additional document processing when a document is in memory. This code takes place in a browser framework that uses indexedDB, and while the policy is unlimited storage, there is always the risk of storing too much, so the goal is to save space. Also, at this point, document processing speed seems reasonable so there is room to run less vital filters. Out of all the filters that might be applied to the document this one is relatively simple and unimportant.

## Other notes
* All the issues with using element coercion apply to this function, such as loss of event listeners
* This processes the document in place rather than returning a copy and staying pure because creating a copy of the document for each filter is cost prohibitive, and because the caller can create a copy if they want.
* The list of tags currently renamed is not exhaustive. There may be other creative ways to reduce space.
* This filter is completely naïve regarding what other filters have been applied to the document in the past or will be applied in the future. There may be wasted work done. For example, the filter that reduces overuse of emphasis may nullify much of this effort.
* This filter does not affect document structure that much in comparison to other filters that remove elements entirely, so it should probably be located later in the sequence of applied filters, so as to minimize the amount of elements it considers.
* Analysis is restricted to tags within the body element. Given html soup and the high variance is browser behavior, the behavior of this filter on tags located outside of the body element is undefined.
* This pays no attention to imperfect situations that arise as a result of the transformations. For example, if input is strong then b, and strong is renamed to b, this leads to `b b`, which ideally would be one b, but this leaves it as two.
* This filter pays no attention to css issues that arise as a result of the transformations. For example, a CSS rule that applies to strong elements will stop working as desired because all strong elements are replaced with b elements.

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

# image-size-filter
Scans the image elements in an html document, and sets the width and height dimensions for images where the width or height are unknown.

## Why does this module exist?
Not all images have a known size after parsing. However, some other functionality really wants to have such information in order to apply more accurate heuristics. For example, the boilerplate analysis filter uses image size as a factor in classifying content as boilerplate.

## Cross-filter concerns
This saves its work inside the document's DOM as attributes of image properties. Other filters called after this filter that perform operations like attribute filtering should take care to not accidentally remove the dimensions, at least not until after the width and height attributes are no longer needed.

## Todos
* why am i waiting to update the image until after information for all images is set? why not just update the image immediately? Each promise can concurrently issue updates to the DOM, so why wait?
* Avoid repeatedly fetching the same image. An image can appear multiple times in a document. Right now this does a fetch per occurrence. This is not the end of the world because I assume that images are cached and that the stuff underlying fetch calls is smart enough to use the cache. However, I need a list of unique images with each having a list of its occurrences. However this is problematic, because what about varying dimensions of the same image, along with the goal of using those to avoid fetches. I think what I want is two passes. The first pass processes those images that can be processed without network requests. It builds a list of those images where it cannot process them locally. Then the second step does the network requests and does it based off a set of distinct urls instead of the full occurrences array.
* Write tests
* support "filename.w500.h500.jpg"
* support "foo-730x420-bar.jpg"
* support both - and _ delimiters
* always return dimensions, just return 0s on failure, so that caller no longer cares if defined or not, this is basically use of sentinel values, kind of like an optional, it avoids the need to worry about accessing an undefined value.

## unorganized test notes and todos
* test image missing src with srcset
* test multiple images
* test an against-policy failure when policy is set
* test when an image uses attributes different than natural dimensions (a resized-by-attribute image), I believe the resized dimensions in this case should trump the natural dimensions

TODO: move this comment somewhere, i dunno, github issue

# visibility-filter

// Removes hidden elements from a document. This filter is impure in that it
// mutates the input document due to the prohibitive cost of cloning.
// @param document {Document} the document to filter. Assumes the document is
// implicitly html-flagged and not xml-flagged.
// @param matte {color} see color contrast filter docs
// @param mcr {number} see color contrast filter docs
// @error {Error} if document is undefined or not a document
// @return {void}

## Implementation notes
// Assume this works because the document is implicitly html-flagged and not
// xml-flagged. This is naively preferred to querySelector for terseness and
// speed.

// Ignore elements outside of body. Elements outside of body are assumed to
// be hidden or otherwise properly ignored by later consumers of a document's
// content. If there is no body, then this is a no-op and we are done.
// The document is not guaranteed to have a body.


// Iterate over all elements, checking each element individually if it is
// hidden. If an element is hidden it is 'removed'.

// Rather than some manual walk of the dom tree, which seems like it would be
// fast because it avoids traversing hidden branches, benchmarking
// demonstrates that it is substantially faster to iterate over all elements
// and checking per visit whether an element is still present in the tree. I
// think that the basic reason for this is that querySelectorAll and
// document.contains are both highly optimized, and because more processing
// occurs natively. At one point this did a walk, unfortunately I've lost
// sight of that old implementation. It would have been nice to keep around
// for benchmarking.
// TODO: reintroduce benchmarks that prove this statement, or link to an
// authoritative resource.

// This uses querySelectorAll over getElementsByTagName because it greatly
// simplifies the task of removing elements during iteration, and allows the
// use of for..of.

// TODO: so now i remember the original issue regarding why this does unwrap
// instead of remove. the problem is with documents that use progressive
// reveal techniques. such documents use a common technique where a document's
// content is initially hidden, and then later made visible by script once
// the document is loaded. in one of the earliest implementations of this
// filter, i did removal. this lead to the issue of seeing empty documents in
// the view that should not be empty. in other words the filter caused the
// app's view to stop correctly mimicing the actual browsing experience. i
// would like to revisit this. i think this decision is unfortunately the main
// reason that i see a ton of junk content appearing in the view. perhaps i
// could use a whitelist approach. whitelist sites that use the revealing
// technique, check origin here, if whitelisted then unwrap, otherwise remove.
// this is obviously not the best solution but perhaps it is better than now?
// the problem is kind of boilerplate filtering issue. maybe it really is
// functionality that should be a subset of the boilerplate algorithm, and
// distinguishing this filter from the boilerplate filter was a mistake (back
// when everything was all one monolithic pass).


// NOTE: initially the contrast filter was done separately, but I then made
// the design decision to strongly couple the the contrast filter with this
// filter. both have the same objective of removing hidden elements. it makes
// sense to co-locate them (have one occur right after the other). having
// low-contrast is just another example of being hidden.

// This color contrast filtering is done in a second pass, largely because it
// was initially implemented in separate modules and the caller had to call
// both this filter and the color contrast filter independently. I don't think
// the perf cost of that decision is too harmful. I might want to revisit
// this and rewrite the code as if I had originally written both together.

// TODO: I could consider inlining the function here now? Or at least moving
// the function's definition here, because it does not need to standalone. I
// think this is the sole caller? other than some tests? I could make it a
// helper here and a second export. then again also take a look at the todos
// in the contrast filter, i had some thoughts about the granularity of the
// abstraction, it may be wrong in the first place. the decision of whether
// to inline it all here should probably happen after i make those other
// decisions.
