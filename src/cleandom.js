(function(exports) {

'use strict';

function sanitize_html_document(doc) {

  // Remove misc elements, generally style elements
  const misc_selector = [
    'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
    'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink',
    'font', 'plaintext', 'small', 'tt'
  ].join(',');
  unwrap_elements(doc.body, misc_selector);

  transform_form_elements(doc.body);
  unwrap_hidden_elements(doc.body);
  remove_consecutive_br_elements(doc);
  remove_consecutive_hr_elements(doc);
  remove_anchors_with_invalid_urls(doc.body);
  unwrap_non_link_anchors(doc.body);
  filter_sourceless_imgs(doc);

  // Deal with out of place elements
  filter_hr_children_of_lists(doc);
  adjust_block_inlines(doc);

  normalize_hairspace_entities(doc);
}

function transform_form_elements(ancestor_element) {
  if(!ancestor_element)
    return;

  // Unwrap forms
  const form_elements = ancestor_element.querySelectorAll('form');
  for(const form_element of form_elements)
    unwrap_element(form_element);

  // Unwrap labels
  const label_elements = ancestor_element.querySelectorAll('label');
  for(const label_element of label_elements)
    unwrap_element(label_element);

  // Remove form fields
  const input_selector =
    'button, fieldset, input, optgroup, option, select, textarea';
  const input_elements = ancestor_element.querySelectorAll(input_selector);
  for(const input_element of input_elements)
    input_element.remove();
}

function unwrap_hidden_elements(ancestor_element) {
  if(ancestor_element) {
    const doc_element = ancestor_element.ownerDocument.documentElement;
    const elements = ancestor_element.querySelectorAll('*');
    for(const element of elements)
      if(doc_element.contains(element) && element_is_hidden(element))
        unwrap_element(element);
  }
}

function remove_consecutive_br_elements(doc) {
  const elements = doc.querySelectorAll('br + br');
  for(const element of elements)
    element.remove();
}

// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
function remove_consecutive_hr_elements(doc) {
  const elements = doc.querySelectorAll('hr + hr');
  for(const element of elements)
    element.remove();
}

// This matches against children; not all descendants
// TODO: support dd or whatever it is
function filter_hr_children_of_lists(doc) {
  const elements = doc.querySelectorAll('ul > hr, ol > hr');
  for(const element of elements)
    element.remove();
}

function remove_anchors_with_invalid_urls(ancestor_element) {
  if(ancestor_element) {
    const anchor_elements = ancestor_element.querySelectorAll('a');
    for(const anchor_element of anchor_elements)
      if(is_invalid_anchor(anchor_element))
        anchor_element.remove();
  }
}

function is_invalid_anchor(anchor_element) {
  const href_value = anchor_element.getAttribute('href');
  return href_value && /^\s*https?:\/\/#/i.test(href_value);
}

// An anchor that acts like a span can be unwrapped
// Currently misses anchors that have href attr but is empty/whitespace
// TODO: restrict to body
function unwrap_non_link_anchors(ancestor_element) {
  if(ancestor_element) {
    const anchor_elements = ancestor_element.querySelectorAll('a');
    for(const anchor_element of anchor_elements)
      if(!anchor_element.hasAttribute('href'))
        unwrap_element(anchor_element);
  }
}

function filter_sourceless_imgs(doc) {
  const imgs = doc.querySelectorAll('img');
  for(const img of imgs)
    if(!img.hasAttribute('src') && !img.hasAttribute('srcset'))
      img.remove();
}

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
// TODO: this rearranges content in an unwanted way if when there is sibling
// content under the same inline. It takes the one block child and moves it
// to before its previous siblings which is basically corruption.
function adjust_block_inlines(doc) {
  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_selector = 'a, span, b, strong, i';
  const blocks = doc.querySelectorAll(block_selector);
  for(const block of blocks) {
    const ancestor = block.closest(inline_selector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild)
        ancestor.appendChild(node);
      block.appendChild(ancestor);
    }
  }
}

// TODO: accessing nodeValue does decoding, so maybe this doesn't work? Forgot.
// TODO: should this be restricted to body?
function normalize_hairspace_entities(doc) {
  const iterator = doc.createNodeIterator(
    doc.documentElement, NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    const value = node.nodeValue;
    const modified_value = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modified_value.length !== value.length)
      node.nodeValue = modified_value;
  }
}

exports.sanitize_html_document = sanitize_html_document;

}(this));

/*

# TODO

* Rename to "mangle"

* Maybe this is too opaque and composes too much functionality together and
it would be better to implement smaller, more granular modules that do one
thing


* For italicized or bolded text, check against a max character length, and if
text is too long, unwrap the italic/bold formatting. This will reduce the
number of times I see a full paragraph of italicized text which is difficult
to read, but still keep situations where just a small sentence or phrase is
emphasized. Maybe this should be a separate module "emphasis-filter".

* write tests
* Fix things like <b><table></table></b>, see https://html.spec.whatwg.org/multipage/parsing.html mentions of adoption
algorithm and its errata notes
* removing sourceless images should maybe take into account parent picture tag
if present

# Why unwrap_hidden_elements uses doc.contains

This uses querySelectorAll instead of getElementsByTagName to avoid the issue
with removing while iterating on a live node list leading to changing indices.

querySelectorAll yields all elements. While iterating, hidden elements are
removed. When removing a hidden element, its child elements are implicitly
also removed. However, removing an element from the dom (detaching) does not
also remove the elements from the node list created by querySelectorAll. This
means that those nodes will still be visited during a later iteration of the
loop, and will still be tested, and if hidden, removed again. Detaching an
already detached node is pointless. It is harmless in one sense, but it does
impact performance. Dom operations are expensive. The general assumption is that
it is better to do more operations in JS if it reduces DOM touches. Therefore,
the goal is to avoid detaching already detached nodes. To do this, I check
whether the document element (the root) still contains the current element. If
it does, this means the node has not been detached as a result of some prior
iteration, and therefore is pointless to manipulate. The contains method is a
read method as opposed to the unwrap operation which implicitly involves a
write method (a remove). I assume that read operations are generally fast even
if they still involve the dom. Using some_ancestor.contains is the only way
I know of to check if a node is still detached. Note that detaching a node
does not nullify its ownerDocument property, so there is no simple solution
for that.

A long time ago I tried a walk method that simply avoided recursing down toward
children of a node if the node was removed. Unfortunately, the walk operation
is incredibly slow. I tried both a dom walker native and a custom walker that
walked siblings and child nodes. I also tried a recursive one, a tail optimized
recursive one, and a stackless one that used a while loop and a custom stack.
These were all slower than simply using querySelectorAll and contains. This is
rather counter intuitive. But the reason I guess is that querySelectorAll is
a frequently used method in JS so browsers have optimized for it.

I unfortunately did not record these other attempts. They may be in github
history. I did not record a performance benchmark, and I did not make the
benchmark repeatable. That may be something to eventually consider doing. I
suppose if it turns out that hidden elements is really slow.

# Filtering hidden elements notes

Concerned about performance of using element.style. See https://bugs.chromium.org/p/chromium/issues/detail?id=557884#c2 . The issue was
closed, but they are claiming that element.style performance has been improved.
I need to revisit the performance of this function, and consider reverting back
to the style based approach. I think the best thing to do is setup a test case
that compares the performance of using element.style to querySelectorAll or
getAttribute or other methods.

- not using element.style is resulting in what appears to be a large number of
false positives. perhaps the perf increase is not worth it.

I've since reverted to checking element.style. I am not longer using the faster
querySelectorAll method because it is so inaccurate. Now I rely on the
element_is_hidden method.

# Why unwrap_hidden_elements currently unwraps instead of removes

Using unwrap instead of remove at the moment due to issues with
sites that use script to show hidden content after load appearing to have
no content at all.

I need to think of a better way to do this.

# Filtering tiny images

Removing telemetry image <img src="s.gif" height="1" width="0">

I am requiring both dimensions in lonestar_transform_document now, so it
will no longer catch these. That means sanitize has to look for these and
remove them if desired.

# TODO: ideas for improvements (copied from old github issue)

This originally removed elements. Now it just unwraps. This helps avoid an issue with documents that wrap all content in a hidden element and then dynamically unhide the element. For example: view-source:http:stevehanov.ca/blog/index.php?id=132. This pages uses a main div with inline visibility hidden, and then uses an inline script at the bottom of the page that sets the visibility to visible. I also think this is a document produced by Macromedia Dreamweaver, so this is not pathological.

I have mixed feelings about revealing hidden content. There is an ambiguity regarding whether the content is useful. It is either content subject to the un-hide trick, or it is content that is intentionally hidden for some unknown reason by the author. It does not happen very often anymore but some authors hide content maliciously to fool search engines or simply because it is remnant of drafting the page, or because it is auxiliary stuff, or because it is part of some scripted component of the page.

Now that this unwraps, do additional testing to see if unwrapped content appears. Maybe a middle ground is to remove if removing does not leave an empty body. As in, if the parent is body, unwrap, otherwise remove.

Removing nodes that reside in a node already removed is harmless. However, it is a wasted operation, and dom operations are generally expensive. This checks 'contains' so as to avoid removing elements that were already removed in a prior iteration. Nodes are walked in document order because that is how querySelectorAll produces its NodeList content. Therefore descendants are visited after ancestors. Therefore it is possible to iterate over descendants that reside in an ancestor that was already removed.

I would prefer to not even visit such descendants. I suppose I could use a TreeWalker. However, I have found that tree walking is slow.

However, maybe it is worth it to experiment again.

# TODO: replace br with p tags

What I essentially want to do is remove all BR elements and replace them with paragraphs. This turns out to be very tricky because of the need to consider a BR element's ancestors and whether those ancestors are inline or not inline.

# TODO: improve noscript handling

Look into whether I can make a more educated guess about whether to unwrap or to remove. For example, maybe if there is only one noscript tag found, or if the number of elements outside of the node script but within the body is above or below some threshold (which may need to be relative to the total number of elements within the body?)

One of the bigger issues is that I show a lot of junk in the output. Maybe the boilerplate filtering should be picking it up, but right now it doesn't.

*/
