The `transform_document` function transforms a document by removing or changing nodes for various reasons, such as:
* to condense the size of the document by removing extraneous content
* to remove hidden text and hidden markup
* to remove uninformative content
* security reasons such as removing scripts
* to preload images
* anti-telemetry
* normalization/canonicalization, such as resolving urls
* to make the document embeddable directly in the app's view without the use of iframes or shadow roots or any of that stuff, such as by removing element ids and style elements and attributes

For performance reasons, the document is mutated. In other words, the transformation is applied to the input, in-place. Ideally this would be a pure function but cloning the document is not very feasible.

### Implementation notes
This basically acts as a wrapper to all the content filters. The module adds value primarily by defining the order in which filters are applied, and by applying app-specific settings to otherwise generic modules (further specializing the filters to this app's purpose).

The transform is async primarily because of one critical filter step that must occur after some filters but before others, that is async, the step where images are fetched in order to determine image sizes. Filters like telemetry removal need to occur beforehand, but some additional sanity and shrinking filters need to occur after. I am not entirely sure if this is the right design as I would rather minimize the use of async, but I have not thought of a better way. Once one function is async pretty much all callers up the stack need to be async.

One of the first implementations of this module started off with a tree walker that applied transformations to each node. It turns out that repeatedly executing query selectors is substantially faster by several orders of magnitude. This lead to the breakdown of the query selectors into individual filters. However, the goal of this module is to encapsulate this implementation detail and abstract it away. Given the substantial improvements in v8 recently I still wonder if the tree-walker approach is viable.

### Params
* **document** {Document} the document to transform
* **document_url** {URL} the location of the document
* **options** {Object} various options, all of which are optional

### Options
* **fetch_image_timeout** {Number} optional, the number of milliseconds to wait before timing out when fetching an image
* **matte** {color} the default background color to use when determining an element's background
* **min_contrast_ratio** {Number} the ratio to use when determining whether an element's content is visible
* **emphasis_length_max** {Number} the maximum number of characters in a section of emphasized text before the emphasis is removed

### Errors
* type errors (invalid input)

### Return value
Returns a promise that resolves to undefined or rejects when an internal error occurs

### TODOS
* add console arg to filters to enable logging by filter
* I need to comb through the filters and remove all app-specific functionality. It should be parameterized, where the parameters are set here, not in the filter
* For example, for the image-size-filter, I should be passing in a fetch policy that is defined here (or uses the app's fetch-policy), instead of deferring to the default fetch policy or hard-coding the app policy within the filter itself.
