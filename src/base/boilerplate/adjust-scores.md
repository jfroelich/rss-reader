* TODO: store adjustment score in block for debugging
* TODO: implement tests
* TODO: verify the double counting problem is solved

### Old notes on the double counting issue
I think it is solved but have not yet verified. Until it is verified I am leaving the notes here for reference. I want to solve the double counting problem. I think to match how document-length is calculated, what i want to do is get total length, and then get the total length of boilerplate blocks, the substract that. this way i do not naively sum up lengths of content blocks and double count. but note that this still assumes that if an ancestor is boilerplate, then all its descendants are boilerplate too. this is also a separate and more fundamental question. right now i just look at filter behavior, it just strips by block if boilerplate, meaning that it implicitly strips descendants, meaning i have kind of already made my decision

We can solve it by not answering that question. Just add up the negative space without double counting. I think that solves it, except for the issue of content nested within boilerplate. Does content nested within boilerplate ever show up? Actually this might still be the same fundamental issue just viewed from a different angle. The thing is, it also kind of ties into the entire concept of scoring elements. I am scoring elements individually for this purpose, or am I scoring them while considering their location within the hierarchy. for example, if i know that i want some content to appear then i know that its ancestors have to be scored highly enough, so i want heuristics that bump ancestor scores. am i doing that?

That doesn't solve it. I need to treat all blocks independently. I should be using the same metric as how the document length is calculated

if blocks are hierarchical, then is this duplicating length because of the overlap? this seems entirely incorrect???? i want to get the length without double counting the overlap of blocks. so what i want to do really is find the set of all disconnected content blocks first, then add up their lengths. i should iron this out with a test and be really clear. this might be the reason i am not seeing the adjustment have much of an effect, leading to a lot of blanked articles.

but to add to that, now i am confused. let's say i have blocks abc, a contains b and c. a is content, b is content, and c is boilerplate. what is the total content length in this case? so right now the algorithm returns a+b, which i am pointing out is wrong, because it double counts b's length, because it counts b for b, and b for a as well. so it should not be a+b. it should just be b? what if b is boiler? then it should be a + -b + -c?

Another way to state things. If I add up the boilerplate length and the content length, it should be equal to document length. if not, i am doing something wrong.

Part of the problem is determining a block's own length. I need to get the text length of the child text nodes, not all descendant text nodes.

Another subtle issue is again that not all dom elements are blocks. but document_length is a measure of ALL dom content, not just block content. so i am mixing together different measurements here too.

Ok, so try this: write a function like block_get_own_length. doesnt matter if content or boilerplate.

content length is comprised of:
* all non-block elements, these are always visible
* all content block elements
* all boilerplate block elements

Actually do this: sum up the block_get_own_length(boilerplate_block), then subtract this from document length to find content length, then calculate the ratio. but, we still have possible nested boilerplate. we only want those boilerplate blocks not nested. and we can just use block-length, not own length, because if an ancestor is boilerplate then right now the algorithm removes all descendants.


some old temp code that will be deleted shortly:
```javascript
// Returns whether the block represents
// content, considering the block itself
// AND its ancestors.
export function is_visible(
  block, threshold) {
  let cursor = block;
  while (cursor) {
    if (cursor.score < threshold) {
      return false;
    }

    const index = cursor.
      parent_block_index;
    cursor = index < 0 ?
      undefined : blocks[index];
  }

  return true;
}```
