
Provides basic color utilties




A color is represented by a signed 32 bit integer, the javascript primitive.
Some online stuff provides this is basically a vector. A vector's items are
called components. This is why, when referring to red or blue parts of a color,
they are sometimes called components.


# About the contrast calculation

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

# References and research

* https://en.wikipedia.org/wiki/Painter%27s_algorithm
* https://en.wikipedia.org/wiki/Linear_interpolation
* https://en.wikipedia.org/wiki/Alpha_compositing#Alpha_blending
* Processing.js lerpColor
* tinycolor library
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
