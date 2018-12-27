# anchor-script-filter
This filter removes certain anchor elements that appear to be *script-related*. An anchor is deemed script-related if, for example, if has an HREF attribute value that contains the JavaScript protocol.

Elements with onclick attributes, or similar attributes that a script-related, are not deemed script-related for purposes of this filter, despite there being an obvious similarity. Those other attributes are assumed to be handled by some other filter, such as one that removes all attributes that are not in a list of allowed attributes.

## Why filter script-related anchors?
The primary reason to use this filter is because script-related anchors will not work as expected when the document is displayed in an embedded context in the UI.

Script is mostly disabled in the UI. Another filter removes script elements. Often the case is that those script elements may create script objects that these javascript-related anchors then reference. Removing the script but not these anchors would lead to the anchor click causing a javascript-related error.

While it is not guaranteed that the other filter that removes script elements is always called together with this filter (in any order), this filter makes the assumption that the other filter is probably in use. I admit here the concerns are linked and this decoupling of the two filters might be wrong. However, there are concerns of this filter not related to the concerns of the script filter that still must be addressed.

It would be misleading to retain these anchors and have them no longer work. It is discordant to click on something and perceive no visible effect.

It would be very insecure to allow the user to cause a trusted click event on an anchor element that comes from an untrusted third party, which basically would be the extension misleading the browser running the extension.

## Anchors are unwrapped instead of removed
There is an important difference between removing an anchor element and unwrapping an anchor element. Removing the element removes both the element and its descendants. Unwrapping the element removes the element but retains its descendants, by approximately replacing the element with its descendants.

Various anchors found in content, even if they are JavaScript-related, may still contain informative content. Informative content should not be removed by some filter unintentionally. This filter should not remove informative content. Therefore, this filter unwraps anchors instead of naively removing them.

## Ripple effects
This is not concerned with ripple effects of removing content, such as the result of adjacent text nodes, the visible decrease in whitespace delimiting displayed content, etc. Some of this concern is addressed by how unwrap is implemented, but there can be other side effects.

## Filter ordering and other filters
* This should occur before filters that modify or remove attributes.
* This should occur after boilerplate analysis, because the ratio of anchor to non-anchor text is one of the boilerplate analysis features
* This is separate from the filter that removes formatting-related anchors, because I decided this is a separate concern.

## Errors
* {Error} if document is undefined or not a {Document}

## Return value
Void

## Todo
* Is there a way to write a CSS selector that imposes a minimum length requirement on an attribute value? This would helpfully reduce the number of anchors matched and move more processing to native. Using a minimum length check would not run into the same problems that a starts-with style check encounters (which is why this does not use starts-with).
* If the selector guarantees the attribute is present, then is the href attribute value guaranteed defined? Such as for &lt;a href&gt;foo&lt;/a&gt;? If so, then there is no need for the href boolean condition here. It will be implicit in the length test.
