# coerce-element
Renames an element. Retains child nodes unless the node is void. Event listeners are not retained.

This tolerates some bad input. For example, if the new name is the same as the old, this detects that case and exits early and does not DOM modification.

## New name validation
This performs some minimal validation of the new name for the element so as to avoid some undesirable outputs. For example, this checks if the new name is null. Internally this calls `document.createElement`, which accepts a name parameter, and behaves unexpectedly by creating an element named <null> when passing an invalid argument like `document.createElement(null);`.

## Void elements
See https://html.spec.whatwg.org/multipage/syntax.html#void-elements.



# visibility
`is_hidden_inline` is designed to work for both inert and live documents. In an inert document, `offsetWidth` and `offsetHeight` are unavailable. They are set to a sentinel value of 0 because they are basically not initialized as a result of parsing. So the faster method of checking only those properties cannot be used.

## Todos
* reconsider using computed style, or have a parameter that decides
* add support for non-css attributes that hide an element
* I need to also add a test that verifies this condition (in both the true and false cases) for input type hidden check
* reconsider aria hints


## unorganized notes and todos and stuff on unwrap_element
* Optimize recursive unwrap, I previously made several attempts at optimization. Unfortunately much of the code is lost. There may still be something in the filter hidden test file. It probably belongs in experimental, the test was created before I decided on organizing experimental code in a folder.
* Research how to move child nodes in a single operation. There does not appear to be a batch node move operation available in the dom api. I spent some time looking and trying to come up with clever alternatives, such as to_element.innerHTML = from_element.innerHTML, but nothing was better. For example this kind of operation would be useful when renaming an element.
* Improve unwrap_element performance when called many times.

filter_unwrappable_elements is one of the slowest functions involved in document cleaning. It seems like this is primarily because unwrap_element is slow. Instead of optimizing unwrap, I am trying to reduce the number of calls to unwrap.

There are several situations where this is possible:

<p><inline><inline>text</inline></inline></p>
<p><inline>whitespace<inline>text</inline>whitespace</p>
<p><inline><inline>text</inline><inline>text</inline></inline></p>
So far I have two implementations, a naive version that unwraps everything, and a crappy more complex version that attempts to reduce the number of calls.

Unfortunately, the naïve approach is still currently better performance. I think part of the problem is that the attempt doubles some of its logic, and involves recursion. For example, I am seeing in a profile that I drop the total time spent calling unwrap, because of the reduced number of calls, but the overhead of the filterUnwrappables function itself increases.

Another problem is due to the recently added support for detecting nesting of multiple inlines. For example, situation 3 above. I can now detect the nesting here, but now the call to unwrap with a 2nd argument works incorrectly. When it unwraps inline2 into p, it detaches inline2. However, it also detaches inline1 because that implicitly detaches inline2. And that is the source of the problem, because detaching inline1 implicitly detaches inline3, when inline3 should in fact still exist at that point. I am still working this out. Another thought is that maybe this isn't a problem. inline3 is still yet to be visited in the iteration of unwrapple elements. It will eventually be visited, and it will still have a parent. The problem is that the parent at that point is no longer attached.

I do not like that is_unwrappable_parent makes a call to match. It feels somehow redundant. match is also slow. one idea is to keep a set (or basic array) of the inline elements initially found, and just check set membership instead of calling matches

I do not like how I am calling is_unwrappable_parent multiple times. First in the iteration in order to skip, and second when finding the shallowest ancestor.

I do not like how I am repeatedly trimming several text nodes. This feels sluggish.

function filter_unwrappables_experimental(document) {
  const elements = document.querySelectorAll(UNWRAPPABLE_SELECTOR);
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(!is_unwrappable_parent(element)) {
      let shallowest = find_shallowest_unwrappable_ancestor(element);
      unwrap_element(element, shallowest);
    }
  }
}

function is_unwrappable_parent(element) {
  let result = element.matches(UNWRAPPABLE_SELECTOR);
  for(let node = element.firstChild; result && node;
    node = node.nextSibling) {
    if(node.nodeType === Node.ELEMENT_NODE) {
      if(!is_unwrappable_parent(node)) {
        result = false;
      }
    } else if(node.nodeType === Node.TEXT_NODE) {
      if(node.nodeValue.trim()) {
        result = false;
      }
    }
  }

  return result;
}

function find_shallowest_unwrappable_ancestor(element) {
  const body = element.ownerDocument.body;
  let shallowest = null;
  for(let node = element.parentNode; node && is_unwrappable_parent(node);
    node = node.parentNode) {
    if(node === body) {
      break;
    }
    shallowest = node;
  }
  return shallowest;
}

# image-element-utils

TODO: cleanup comments, be more concise

TODO: better ripple effects handling. This ties into knowledge of how a
document is modified by all filters. Several filters leave the document in a
variety of states without consideration of other filters. For example, if we
remove an image, and even if we remove figure/picture, then there is still
the possibility that this then results in a leaf node, such as a parent `div`
that is basically empty. In other words the ripple effects are recursive,
which changes the perspective of what remove is doing, and in hindsight makes
it rather naive and questionable whether it is worth it to even attempt to
consider any ripple effects at all.

TODO: Perhaps it would be better if, rather than removing, there was more of
a mark-sweep approach, where images and associated elements were marked for
removal rather than actually removed. This would allow for multiple reasons
for marking. But it would leave junk in there that other filters would have
to consider.

TODO: A similar concern is, for example, hidden elements. There is no point
to processing hidden elements because those are also removed. This naively
goes and considers picture/figure that may be hidden. So the work is
redundant because the concerns are separated. The joint concern is basically
removal. Which suggests the functional purpose should not be oriented based
on whether we are removing an image or some other kind of element, but
instead the action of removal of any content in a document. Something like a
'dom-removal' API, of which handling images and associated elements for
various reasons is just one concern. One of the reasons I have not really
solved it is that the solution ties into the entire design of the content
filters as a series of separate passes with separate concerns. The problem is
in the approach itself.
