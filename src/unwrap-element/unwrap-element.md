## unorganized notes and todos and stuff

* Optimize recursive unwrap, I previously made several attempts at optimization. Unfortunately much of the code is lost. There may still be something in the filter hidden test file. It probably belongs in experimental, the test was created before I decided on organizing experimental code in a folder.
* Research how to move child nodes in a single operation. There does not appear to be a batch node move operation available in the dom api. I spent some time looking and trying to come up with clever alternatives, such as to_element.innerHTML = from_element.innerHTML, but nothing was better. For example this kind of operation would be useful when renaming an element.
* Improve unwrap_element performance when called many times.

filter_unwrappable_elements is one of the slowest functions involved in document cleaning. It seems like this is primarily because unwrap_element is slow. Instead of optimizing unwrap, I am trying to reduce the number of calls to unwrap.

There are several situations where this is possible:

<p><inline><inline>text</inline></inline></p>
<p><inline>whitespace<inline>text</inline>whitespace</p>
<p><inline><inline>text</inline><inline>text</inline></inline></p>
So far I have two implementations, a naive version that unwraps everything, and a crappy more complex version that attempts to reduce the number of calls.

Unfortunately, the naive is still currently better performance. I think part of the problem is that the attempt doubles some of its logic, and involves recursion. For example, I am seeing in a profile that I drop the total time spent calling unwrap, because of the reduced number of calls, but the overhead of the filterUnwrappables function itself increases.

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
