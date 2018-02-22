
The color contrast filter removes text nodes with a text-color to
background-color contrast ratio that is less than or equal to the given minimum
contrast ratio. If no contrast ratio is given then a default contrast ratio is
used.

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

I read somewhere the reason this is so difficult and hard, and the reason there
is no built in eye-dropper-style api call that just gives me an element's color,
is due to security concerns over being able to see user passwords or something.
I eventually want to look into that.

# About the default contrast ratio

Elements with contrast ratios below this threshold are not perceptible. I use a
default value that is lower than the recommendation of 4.5, but distinguishes
red/green better. It screws up dark gray on black. The difference in contrast
ratios is basically because I am making unreliable approximations and because
the immediate audience is a content-filter, not a person.

# TODO: consider using getComputedStyle when getting element background

It is possible I should still use getComputedStyle due to the use of css values such as inherit? Or maybe it doesn't matter since I plan to blend. Or maybe it does because I should not assume that is the only way this function is used

# TODO: make sure getComputedStyle does not cause adoption

Use getComputedStyle based on the document containing the element, not this script's document? I think I saw the note on mdn, getComputedStyle is basically a shortcut for document. My fear is that by using the shortcut, it is using the script document, adopting the element, then doing the calculation. I'd rather not force cross-document adoption.

# TODO: does getComputedStyle ever return undefined?

If the function always returns something then maybe there is no need to check if the result is defined.

# TODO: Handle text shadow more accurately

TODO: WAG spec says to also pay attention to shadow. If a text has a
contrasting shadow then it does contrast. If text does not have a shadow then
look at background. This seems doable. See
https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
Note 5: When there is a border around the letter, the border can add contrast
and would be used in calculating the contrast between the letter and its
background. A narrow border around the letter would be used as the letter. A
wide border around the letter that fills in the inner details of the letters
acts as a halo and would be considered background.

# TODO: Consider deferring filter until render

What if instead of filtering, all I did was
store something like percept-score attribute per element. Then the UI could
dynamically show/hide based on percept-slider. The user could change the
minimum readability-score in real time. That would be kind of cool. Possibly
too toy-like. Would also lead to increased data size instead of reduction

More than that, is re-envisioning how the logic is structured. The current implementation admittedly is a conflation of operations. This both evaluates the model against the data (a document), and applies the model (prunes). What if instead of pruning this just evaluated the model. This opens up a ton of flexibility in how the model is used. The logic becomes less opinionated because now the caller controls how they want to make use of the results (e.g. consider annotation). The tradeoff I suppose is that I have to score the data, and it turns out that doing things like introducing intermediate steps of storing attributes per element is kind of slow. However it does tie in with some thoughts about how I wanted to change the boilerplate filter to also no longer due any pruning.

# TODO: ephemeral visibility ideas

Put some more thought into ephemeral invisibility. all the filters ignore
animation and that elements may become visible over time. if anything i should
be more explicit that filters assume visibility based on initial state. I am
actually not sure I can do anything about it. Perhaps projections of dhtml and
scrolling (in the same way that document screen-shotters scroll down view) that
examines how long content is visible, or when content first becomes visible or
hidden? This would probably require javascript evaluation so I guess it is out
of the question.

# TODO: calibration ideas

The reader app should have a calibration setting that let's the user inform the
app about when they think text is visible. Basically just like video game
installation wizard. Then all this really does is set the min contrast ratio in
local storage, and this applies only to future article processing. Or, if I do late-filtering and just have the contrast filter tag elements, then it can apply
in real time. Basically I don't want to hardcode the min_contrast_ratio. This
would provide a nice way to enable the user to adjust it. The calibration wizard
should warn the user about choosing a high threshold

# TODO: pay more attention to css opacity

Rather than only looking at the alpha channel of background-color, do I also need to pay attention to the opacity property of the element? I know that the hidden-elements filter looks at opacity. Even that maybe should be changed because it might be naive. It feels like there is a bit of an overlapping concern between the hidden-elements filter and the color contrast filter. Maybe opacity should only be a concern here?

Before proceeding I need to clarify some basic things. What does it mean to have an opaque background color with alpha 100%, but an opacity of 0? Does opacity just apply as basically another layer on top of the background color, such as a color of (0,0,0,opacity)? Or is it already built in to the alpha of background color? Basically I do not know what browsers do in this case, and need to find that out.