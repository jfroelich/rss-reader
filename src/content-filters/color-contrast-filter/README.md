# About the color contrast filter

Removes text nodes with a text-color-to-background-color contrast ratio that
is less than or equal to the given minimum contrast ratio. If no contrast
ratio is given then a default contrast ratio is used.

The idea is that the code makes another pass over the content of an article,
during pre-processing, that looks at each element and makes a determination
as to whether an element is faint. If any element is faint, then it is a sign
of a malicious SEO optimization, and that the content of that element is
undesirable and should be filtered.

While I would prefer to design a pure function that returns a new document,
that is too heavyweight. Therefore this mutates the document input in place
in an irreversible, lossy manner.

This filter is very naive. The filter has no knowledge of what other filters
have been applied, or will be applied. This filter completely ignores other
aspects of whether content is visible, such as elements with css display =
none. The filter naively analyzes every text node, including ones that are
basically whitespace. The filter uses an approximation when determining
colors because it is not possible to know color without doing a full
composite pass, which is prohibitively expensive and error-prone, and because
the accuracy difference is marginal.

The filter is restricted to enumerating text nodes within body content,
because nodes outside of body are presumed hidden. However, the color
analysis may consider ancestor elements above the body element during
alpha-blending. Also, browsers tolerate malformed html and may include text
nodes outside of body within the body anyway, so this does not mirror the
browser's behavior.

This has no knowledge of image backgrounds and the hundreds of other ways
that content is rendered like negative margins, non-rectangular shaped
elements, inverted z-indices, custom blend modes, etc. Again, this is an
extremely naive approximation. This views the dom as a simple hierarchy of
overlapping colored boxes, with text leaves, and with most of the boxes being
transparent, and imputes a default white background with default black text
for missing values.

This completely ignores dhtml. The document is analyzed in phase0, the time
the document is loaded, before animations occur and such.

This currently scans text nodes in document order, removing nodes as the
iterator advances. The iterator is smart enough to deal with mutation
during iteration. I do not currently know of a better way to iterate text
nodes.

I decided to scan text nodes, as opposed to all elements, because those are
really the only data points we are concerned with. There isn't much value
in filtering other elements.

# Terminology

A color is represented by a signed 32 bit integer, the javascript primitive.
Some online stuff provides this is basically a vector. A vector's items are
called components. This is why, when referring to red or blue parts of a color,
they are sometimes called components.

# About the default contrast ratio
Elements with contrast ratios below this threshold are inperceptible. I use a
default value that is lower than the recommendation of 4.5, but distinguishes
red/green better. It screws up dark gray on black. The difference in contrast
ratios is basically because I am making unreliable approximations and because
the immediate audience is a content-filter, not a person.

# About the contrast calculation

http:www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef

The spec states that "the ratio is (L1 + 0.05) / (L2 + 0.05), where L1 is
the relative luminance of the lighter of the colors, and L2 is the relative
luminance of the darker of the colors." Luminance is on a scale of [0..1],
where 0 is darkest black and 1 is lightest white. Therefore, a higher
luminance value means a 'lighter' value.

Note that we can add 0.05 before the inequality test because it does not
matter if the addition is done before or after the test, the result of the
inequality does not change (the operations are commutative). Also note that
if the two luminances are equal the result is 1 regardless of which
luminance value is the numerator or denominator in the contrast ratio, so
there is no need to differentiate the values-equal case from the l1 < l2
case.

I am not entirely sure why the spec says to add 0.05. My guess is that it
is an efficient way to avoid the divide-by-zero error if either luminance
is 0 when it is the denominator.

# References and research

* https:en.wikipedia.org/wiki/Painter%27s_algorithm
* https:en.wikipedia.org/wiki/Linear_interpolation
* https:en.wikipedia.org/wiki/Alpha_compositing#Alpha_blending
* Processing.js lerpColor
* tinycolor library
* Unity documentation on vectors and lerp
* https:www.alanzucconi.com/2016/01/06/colour-interpolation/
* https:github.com/gka/chroma.js/tree/master/src
* https:github.com/deanm/css-color-parser-js/blob/master/csscolorparser.js
* https:github.com/substack/parse-color
* https:github.com/bgrins/TinyColor
* https:stackoverflow.com/questions/1855884
* http:jxnblk.com/colorable/
* https:snook.ca/technical/colour_contrast/colour.html#fg=33FF33,bg=333333

# TODO: Handle text shadow more accurately

TODO: WAG spec says to also pay attention to shadow. If a text has a
contrasting shadow then it does contrast. If text does not have a shadow then
look at background. This seems doable. See
https:www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
Note 5: When there is a border around the letter, the border can add contrast
and would be used in calculating the contrast between the letter and its
background. A narrow border around the letter would be used as the letter. A
wide border around the letter that fills in the inner details of the letters
acts as a halo and would be considered background.

# TODO: Vary contrast based on text size

See https:www.w3.org/TR/WCAG20/

# TODO: Consider deferring filter until render

What if instead of filtering, all I did was
store something like percept-score attribute per element. Then the UI could
dynamically show/hide based on percept-slider. The user could change the
minimum readability-score in real time. That would be kind of cool. Possibly
too toy-like. Would also lead to increased data size instead of reduction

# Ephemeral visibility thoughts

put some more thought into ephemeral invisibility. all the filters ignore
animation and that elements may become visible over time. if anything i should
be more explicit that filters assume visibility based on initial state

# Calibration notes

The reader app should have a calibration setting that let's the user
inform the app about when they think text is visible. Basically just like
video game installation wizard. Then all this really does is set the min contrast
ratio in local storage, and this applies only to future article processing. Or,
if I do late-filtering and just have the contrast filter tag elements, then it
can apply in real time.