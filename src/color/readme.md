The color module provides basic color utilities and a simple color data type.

A color is represented by a 32 bit integer, the javascript primitive. Some
online reading shows that this is basically a vector of four items. A vector's
items are called components. This is why, when referring to red or blue parts of
a color, they are sometimes called components.

The use of 32 bits restricts the detail of the color. Components are rounded to
whole numbers (integers). There are more detailed color spaces, but that is
currently outside the scope. There is also the psychological factor, that people
can only perceive so much color detail. There is a limit to the benefit of being
more specific. But really, it is just the rounding. By working with integers
this affords the module several things, chiefly that it can pack all four
components into a 4 byte integer, and does not so quickly need to use an object.

I went with integer because I think it is more efficient. Note that this is a
premature opt. Primitives are copied by value as arguments so there is entirely
the possibility this hurts performance. But I am fascinated by the idea of
avoiding the numerous object/array allocations that would otherwise occur,
and I don't find the downsides of having to use function accessors to be a big
deal, so I am sticking with this opinionated choice for now. This way has been
done before, and is still pretty simple. I also like continually testing my
knowledge of bit operations, with which I continue to struggle.

I could do bit manip but boxed, where I have a `Color` object with an integer
value property, but I still think I am going to stick with prims.

The truth is really that this is an exercise of me doing bit operations, and to
learn about how computers typically work with colors.

# About the contrast calculation

So, interestingly enough, a lot of this lib is dealing with readability and
concerns over content accessibility (e.g. for users with vision difficulty). I
am using it for a slightly different purpose.

I would eventually like to learn more about the reasons behind this formula.

http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef

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

# Misc references and research

* https://en.wikipedia.org/wiki/Painter%27s_algorithm
* https://en.wikipedia.org/wiki/Linear_interpolation
* https://en.wikipedia.org/wiki/Alpha_compositing
* Processing.js lerpColor
* Unity documentation on vectors and lerp
* https://www.alanzucconi.com/2016/01/06/colour-interpolation/
* https://github.com/gka/chroma.js/tree/master/src
* https://github.com/deanm/css-color-parser-js/blob/master/csscolorparser.js
* https://github.com/substack/parse-color
* https://github.com/bgrins/TinyColor
* https://stackoverflow.com/questions/1855884
* http://jxnblk.com/colorable/
* https://snook.ca/technical/colour_contrast/colour.html#fg=33FF33,bg=333333

# TODO: Vary contrast based on text size

* See https://www.w3.org/TR/WCAG20/
* See TinyColor's isReadable function

# TODO: write my own parser to stop relying on third-party

Maybe move color_parse and color_format to a separate module that depends on
color, and acts as a layer above it. It involves a lot of css which is not
logically related to color itself.

# TODO: maybe make a color_valid function

Return true if valid. Pretty much none of the color functions validate input,
pushing all responsibility of sanity checks to the caller. The caller could
benefit from a convenient utility function in this case that has in-depth
knowledge of the color type. So the caller could assert pre-post conditions
using a trivial expression like `assert(color_valid(color))`.
