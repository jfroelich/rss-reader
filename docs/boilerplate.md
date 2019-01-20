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
