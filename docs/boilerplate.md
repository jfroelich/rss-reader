# boilerplate
Boilerplate refers to the common text that appears on several documents that is generally (1) not specific to the idiosyncratic message of a document and (2) does not communicate much information. For example, on the web, when you visit a website, you develop a habit of ignoring various information on a page, such as the header area, the footer area, some of the advertisements on the sides, and so forth. As a human consumer of content, you are quite good at filtering out this junk information and focusing in on the message of the document, as in, what is the content saying to you. Computers, on the other hand, are horrible at this task. Every piece of content initially looks the same.

The boilerplate module provides for the analysis of an HTML document content and the classification of content as useful and informative or junk. It is basically trying to recreate some of the same *selective attention* mechanisms that you might employ when reading on the web.

This can also be understood as a digital signal processing problem, where the average online document has a low *signal to noise ratio*, and this attempts to increase the ratio by reducing the amount of noise. Here, the typical boilerplate that arrives together with the useful content on a given webpage is the noise.

# boilerplate-adjust-scores
This is a private helper module for the boilerplate module. The function adjusts block scores (in place) until a minimum amount of a non-boilerplate content remains in the document. Or at least this tries to do so and gives up after a while. This only adjusts scores of blocks with low scores.

## Why does this module exist?
Removing the right amount of boilerplate is a fickle task. The model uses heuristics regarding whether a piece of content is boilerplate. The model operates on a shallow symbolic level without considering the morphological structure or the semantic meaning of content. There is a risk this shallow analysis removes good content.

This function performs a second pass over the data to ensure that a minimum amount of content remains regardless of model accuracy. After this pass, only the worst offenders remain in the data. This helps counter parts of the algorithm where it is overzealous in flagging bad content.

Ideally the model output should not require further adjustment. But that requires more tuning of the model. Until that time, this extra adjustment suffices.

In some sense this guarantee of minimum content length is part of the model. Perhaps the model should be considering how much content remains in its own analysis. For now I chose to express this concern as independent of the model.

## Parameters
* *blocks* is the array of blocks parsed from the document and scored according
to the boilerplate model
* *options* an optional object that is basically just an aggregation of the other parameters

## Options (for options parameter)
* *document_length* is number of characters in document body
* *delta* is the amount of adjustment to make to a particular block's score in
one pass
* *max_iterations* is the maximum amount of adjustment passes to perform before
giving up
* *content_threshold* is score below which a block is boilerplate
* *ratio_threshold* is ratio of content length to document length, below which
scoring needs adjustment, this algorithm works by making score adjustments
until the ratio is above this threshold, unless it gives up

## Todos
* store adjustment score in block for debugging
* implement tests
* verify the double counting problem is solved using a verifiable test

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
Returns whether the block represents
content, considering the block itself
AND its ancestors.
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


## TODO
* if utils.js is just one function, name file after the one function, or something that is more specific to it. it is a code smell in the first place, but i am currently of the opinion that using a module-local utils file is fine here.
* if get_text_length is not a simple property accessor style of function, then the get qualifier in the name is misleading, because get denotes simple property access, not some kind of arcane calculation. therefore, this function should be renamed so that it better communicates that an approximation of the length is returned instead of the actual length, and that some unusual processing work is done that is more expensive than a simple property access call. the goal should be to minimize the surprise in the API surface. abstracting away this stuff is misrepresentation and careless. it would be different if the norm, the expected behavior, was that any get invocation could involve calculation, but i do not think that is the norm for this project
