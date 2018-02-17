random stuff copied from comments

// This would eventually be incorporated into the content filters.

// References:
// https://en.wikipedia.org/wiki/Painter%27s_algorithm
// https://en.wikipedia.org/wiki/Linear_interpolation
// https://en.wikipedia.org/wiki/Alpha_compositing#Alpha_blending
// Processing.js lerpColor

// I am not totally clear on how to proceed. There are couple concerns:
// * How possible it is to accurately extract the features from the data upon
// which to base the decisions? Can I even get the background color of an
// element correctly? What is the default font size if font is not specified?
// * This does not take into account the overlap with binary (e.g. text on
// image), or the clever ways of laying out content (the element's true
// background color may not correspond to its inline style color,
// not-full-opacity overlapping colors)
// * What is the performance cost of examining these features? Is the extra
// processing cost worth the benefit?
// * Where in the content processing pipeline should this fall? Should it happen
// earlier or later? Before or after certain other critical filter steps?
// * Is there overlap with other content-filters, such that any work done such
// as feature extraction would ultimately be redundant?
// * What is the cost of inaccurate classification? Removing valid content is a
// big risk
// * What is the threshold for perceptibility? What does the psych research say
// regarding legibility based on font size and color contrast? Even then, how
// much credence should be lent to this research versus the practical
// application of such a filter? Maybe I still want low-perceptible content to
// remain?
// * How objective is the metric? Is perceptibility primarily a subjective
// concern? What concrete laws can be formed?
// * Clear up the difference between element.style and getComputedStyle. Does
// element.style yield computed values?
// * What libraries and algorithms already exist?
// * Note the presence of css filters and luminosity and all that stuff. Color
// contrast calculation may not be very straightforward. For example see
// https://css-tricks.com/methods-contrasting-text-backgrounds/
// * According to https://www.w3.org/TR/WCAG20/ it seems like contrast should
// vary based on font size
// * I think I want a progressive approach. Start with a dumb implementation
// that mostly works, then refine it to be smarter.
// * Some strange thought about what happens when you color calibrate a new
// video game regarding true-black and gray-scales. Perhaps I can setup a page
// with a slider that helps me pick points of perceptibility
// * Perhaps I should be more abstract. Create a module called
// 'perceptibility.js' that focus on the general concept of differentiating html
// elements. Then the filter is just the glue code that ties in the general
// module to the app's content-pre-processing pipeline.
// * Shorter name, perceptible.js or percept.js or text-percept.js
// * Perhaps I should generalize this even more, and look at spam-filtering
// algorithms, what features are considered. Surely someone has already done
// some of this, somewhere.
// * These notes should all be on github, not here.
// * Deferred filtering concept. What if instead of filtering, all I did was
// store something like percept-score attribute per element. Then the UI could
// dynamically show/hide based on percept-slider. The user could change the
// minimum readability-score in real time. That would be kind of cool. Possibly
// too toy-like. Would also lead to increased data size instead of reduction
// * Side reading: https://stackoverflow.com/questions/1855884
// * http://jxnblk.com/colorable/
// * https://snook.ca/technical/colour_contrast/colour.html#fg=33FF33,bg=333333



// TODO: answer this question: do I use element.style, or getComputedStyle?
// According to comment https://stackoverflow.com/questions/1887104
// "The style property only contains styles assigned in a style attribute or
// set by scripting."
// TODO: do not forget the difference between inert document and live
// document, check if behavior varies. Assume element resides in an inert
// document.
// TODO: do not forget that some elements do not have element.style
// Write out a clear answer to these questions before proceeding.

// Per MDN, The HTMLElement.style property is used to get as well as set the
// inline style of an element. While getting, it returns a CSSStyleDeclaration
// object that contains a list of all styles properties for that element with
// values assigned for the attributes that are defined in the element's inline
// style attribute. The style property is not useful for completely learning
// about the styles applied on the element, since it represents only the CSS
// declarations set in the element's inline style attribute, not those that
// come from style rules elsewhere, such as style rules in the <head> section,
// or external style sheets. To get the values of all CSS properties for an
// element you should use window.getComputedStyle() instead.

// See https://stackoverflow.com/questions/5999209
// if there is no definition of background-color under some element, Chrome
// will output its background-color as rgba(0, 0, 0, 0), while Firefox
// outputs is transparent.

// Computed style
// @type {CSSStyleDeclaration}
const cs = getComputedStyle(element);
// Computed background color string. Equivalent to
// cs.getPropertyValue('background-color')
const cbcs = cs.backgroundColor;

// Pretty much everyone else calls the return value 'color'. The 'color'
// variable is the property value. It is a string.
// Browsers can return almost anything. A hex code (3 char or 6 char),
// a named color, an RGB value, or an RGBA value. So you kind of need a
// a general parser.
// What I could do is just support at least one format for now, and return
// something like undefined/NaN in other cases.
// I feel like this functionality is already in the browser

// https://github.com/deanm/css-color-parser-js/blob/master/csscolorparser.js
// https://github.com/substack/parse-color
// https://github.com/bgrins/TinyColor

// So basically, before making progress in this module, I need to implement
// a color parser. Or find one. And a color converter that can coerce between
// color formats

// Actually it looks like tinycolor is the closest thing, it even has a
// tinycolor.readability that is pretty much what i want, and it works
// based on the standard, which is what i was planning to do






/*
From main.js source script for https://webaim.org/resources/contrastchecker/

var f, b;

$(function() {

        var $textInputs = $('#fHex, #bHex'),
                        $colorInputs = $textInputs.add('#fPick, #bPick'),
                        $colorSliders = $('#fLightness, #bLightness');

        initialize();

        $textInputs.focus(function() {
                $(this).select();
        });

        $colorSliders.mousedown(function() {
    $(this).mousemove(function() {
                        changeHue($(this).attr('id').substr(0, 1));
    });
        }).on('mouseup mouseout', function() {
                        $(this).unbind('mousemove');
        });

        $colorSliders.change(function() {
                changeHue($(this).attr('id').substr(0, 1));
        });

        $colorInputs.change(function() {
                var $this = $(this),
                                color = $this.val(),
                                context = $this.attr('id').substr(0, 1);

                $('#' + context + 'Error').slideUp();
                if (color.substr(0, 1) !== '#') color = '#' + color;
                if (color.length == 4) color = '#' + color.substr(1,
1).repeat(2) + color.substr(2, 1).repeat(2) + color.substr(-1).repeat(2);
                $this.val(color);

                // Validation
                if (color.length !== 7 || isNaN(getRGB(color.substr(1)))) {
                        $this.attr({'aria-invalid': true, 'aria-describedby':
context + 'Error'});
                        $('#' + context + 'Error').slideDown('fast', function()
{ $this.focus();
                        });
                } else {
                        $this.removeAttr('aria-invalid aria-describedby');
                        $('#' + context + 'Error').slideUp('fast');
                        eval(context + '= color.toUpperCase()');
                        update();
                }
        });

        // Intercept form submit
        $('#contrastForm').submit(function(e) {
                e.preventDefault();
        });
});

// Update all when one is changed
function update() {
        $('#fHex, #fPick').val(f);
        $('#bHex, #bPick').val(b);
        $('#normal, #big').css({'color': f, 'background-color': b});
        $('#permalink').attr('href', './?fcolor=' + f.substr(1) + '&bcolor=' +
b.substr(1));

        // Update lightness sliders
        var fHSL = RGBtoHSL(getRGB(f.substr(1, 2)), getRGB(f.substr(3, 2)),
getRGB(f.substr(-2))); var bHSL = RGBtoHSL(getRGB(b.substr(1, 2)),
getRGB(b.substr(3, 2)), getRGB(b.substr(-2)));
        $('#fLightness').val(Math.round(fHSL[2]))
                .next('div.gradient').css('background', 'linear-gradient(to
right,hsl(' + fHSL[0] + ',' + fHSL[1] + '%,0%), hsl(' + fHSL[0] + ',' + fHSL[1]
+ '%,50%), hsl(' + fHSL[0] + ',' + fHSL[1] + '%,100%))')
        $('#bLightness').val(Math.round(bHSL[2]))
                .next('div.gradient').css('background', 'linear-gradient(to
right,hsl(' + bHSL[0] + ',' + bHSL[1] + '%,0%), hsl(' + bHSL[0] + ',' + bHSL[1]
+ '%,50%), hsl(' + bHSL[0] + ',' + bHSL[1] + '%,100%))')
                ;

        // Update contrast ratio
        checkContrast();
}

// Calculation Functions

function changeHue(context) {
        HSL = RGBtoHSL(getRGB(eval(context).substr(1, 2)),
getRGB(eval(context).substr(3, 2)), getRGB(eval(context).substr(-2))); RGB =
HSLtoRGB(HSL[0], HSL[1], $('#' + context + 'Lightness').val()); for (var i = 0;
i < 3; i++) { RGB[i] = (RGB[i] >= 16) ? RGB[i].toString(16) : '0' +
RGB[i].toString(16);
        }
        eval(context + '= "#" + (RGB[0] + RGB[1] + RGB[2]).toUpperCase()');
        update();
}

function checkContrast() {
        var L1 = getL(f), L2 = getL(b), ratio = (Math.max(L1, L2) + 0.05) /
(Math.min(L1, L2) + 0.05);
        $('#ratio').html('<b>' + (Math.round(ratio * 100) / 100).toFixed(2) +
'</b>:1'); if (ratio >= 4.5) {
                $('#normalAA, #bigAAA').attr('class', 'pass').text('Pass');
                $('#ratioContainer').attr('class', 'pass');
        } else {
                $('#normalAA, #bigAAA').attr('class', 'fail').text('Fail');
                $('#ratioContainer').removeClass('pass');
        }
        if (ratio >= 3) {
                $('#bigAA').attr('class', 'pass').text('Pass');
        } else {
                $('#bigAA').attr('class', 'fail').text('Fail');
        }
        if (ratio >= 7) {
                $('#normalAAA').attr('class', 'pass').text('Pass');
        } else {
                $('#normalAAA').attr('class', 'fail').text('Fail');
        }
}

function getRGB(c) {
        try {
                var c = parseInt(c, 16);
        } catch (err) {
                var c = false;
        }
        return c;
}

function HSLtoRGB(H, S, L) {
        var p1, p2;
        L /= 100;
        S /= 100;
        if (L <= 0.5) p2 = L * (1 + S);
        else p2 = L + S - (L * S);
        p1 = 2 * L - p2;
        if (S == 0) {
                R = G = B = L;
        } else {
                R = findRGB(p1, p2, H + 120);
                G = findRGB(p1, p2, H);
                B = findRGB(p1, p2, H - 120);
        }
        return [Math.round(R *= 255), Math.round(G *= 255), Math.round(B *=
255)];
};

function RGBtoHSL(r, g, b) {
        var Min, Max;
        r = (r / 51) * 0.2;
        g = (g / 51) * 0.2;
        b = (b / 51) * 0.2;
        if (r >= g) {
                Max = r;
        } else {
                Max = g;
        }
        if (b > Max) {
                Max = b;
        }
        if (r <= g) {
                Min = r;
        } else {
                Min = g;
        }
        if (b < Min) {
                Min = b;
        }
        L = (Max + Min) / 2;
        if (Max == Min) {
                S = H = 0;
        } else {
                if (L < 0.5) {
                        S = (Max - Min) / (Max + Min);
                } else {
                        S = (Max - Min) / (2 - Max - Min);
                }
                if (r == Max) {
                        H = (g - b) / (Max - Min);
                }
                if (g == Max) {
                        H = 2 + ((b - r) / (Max - Min));
                }
                if (b == Max) {
                        H = 4 + ((r - g) / (Max - Min));
                }
        }
        H = Math.round(H * 60);
        if (H < 0) {
                H += 360;
        }
        if (H >= 360) {
                H -= 360;
        }
        return [H, Math.round(S * 100), Math.round(L * 100)];
}

function findRGB(q1, q2, hue) {
        if (hue > 360) hue -= 360;
        if (hue < 0) hue += 360;
        if (hue < 60) return (q1 + (q2 - q1) * hue / 60);
        else if (hue < 180) return(q2);
        else if (hue < 240) return(q1 + (q2 - q1) * (240 - hue) / 60);
        else return(q1);
}

function getsRGB(c) {
        c = getRGB(c) / 255;
        c = (c <= 0.03928) ? c / 12.92 : Math.pow(((c + 0.055) / 1.055), 2.4);
        return c;
}

function getL(c) {
        return (0.2126 * getsRGB(c.substr(1, 2)) + 0.7152 * getsRGB(c.substr(3,
2)) + 0.0722 * getsRGB(c.substr(-2)));
}

*/


put some more thought into ephemeral invisibility. all the filters ignore
animation and that elements may become visible over time. if anything i should
be more explicit that filters assume visibility based on initial state
