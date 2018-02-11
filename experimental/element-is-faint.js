
// This would eventually be incorporated into the content filters. The idea is
// that the code makes another pass over the content of an article, during
// pre-processing, that looks at each element and makes a determination as to
// whether an element is faint. If any element is faint, then it is a sign of a
// malicious SEO optimization, and that the content of that element is
// undesirable and should be filtered.

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
// module to the app's content-pre-processing pipeline
// * Perhaps I should generalize this even more, and look at spam-filtering
// algorithms, what features are considered. Surely someone has already done
// some of this, somewhere.

// Return true if an element is barely perceptible. Perceptibility could be
// based on many things. One thing would be small font size. Another is low
// or 0 contrast between foreground text color and background color.
function element_is_faint(element) {
  return false;
}
