# About the color contrast filter
The color contrast filter removes text nodes with a text-color to background-color contrast ratio that is less than or equal to a minimum contrast ratio. The filter scans the content of an html document and looks at each element and makes a determination as to whether an element is difficult to perceive. The assumption is that an author of an article tends to make important text readily perceptible. If any element is faint, then it is a sign of a malicious SEO optimization, where the author wanted to include text visible to search engine bots but not visible to the typical browser user. The content of that element is undesirable and should be filtered.

While I would prefer to design a pure function that returns a new document, that is too heavyweight. Therefore this function mutates the input document in place in an irreversible, lossy manner.

This filter is naive:

* The filter has no knowledge of what other filters have been applied, or will be applied. There could be redundant work being done, elements repeatedly analyzed in similar ways, or pointless work like the analysis of an element that will eventually be removed by another filter.
* This filter ignores other aspects of whether content is visible, such as elements with css `display:none`. I decided that element visibility is the concern of some other filter. It is worth the cost of having multiple passes over the content (if that is even much of a cost) so as to separate concerns of different filters.
* The filter naively analyzes every text node, including ones that are basically whitespace and therefore unimportant. A future design could prioritize performance and avoid analysis of certain basic elements.
* The filter uses an approximation when determining colors because it is not possible to know color without doing a full composite pass, which is prohibitively expensive and error-prone, it is difficult to maintain fidelity to browser rendering, it basically means recreating the entire compositor code which feels like a truly dumb idea, and because the accuracy difference is marginal. There are other similar issues. For example, this ignores average monitor brightness. This ignores rounding errors that result in loss of precision of color components. I am not even entirely sure I implemented the color code correctly. I would rather error on the side of conservative filtering.

The filter is restricted to enumerating text nodes within body content, because nodes outside of body are presumed hidden. However, the color analysis may consider ancestor elements above the body element during alpha-blending. Also, browsers tolerate malformed html and may include text nodes outside of body within the body anyway, so this does not mirror the browser's behavior.

This filter has no knowledge of image backgrounds and the numerous other ways that content is rendered such as negative margins, non-rectangular shaped elements, inverted z-indices, custom blend modes, etc. Again, this is an extremely naive approximation. This views the content as a simple hierarchy of overlapping colored boxes, with text leaves, with most of the boxes being transparent, and imputes a default white background with default black text for missing values.

This filter completely ignores dynamic html. The document is analyzed in phase 0, the time the document is loaded, before animations occur. For example, content that begins at low contrast but is animated over time using Javascript to become high contrast, is only observed at the time it is low contrast (and therefore is filtered).

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
