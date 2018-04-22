The boilerplate filter classifies elements as boilerplate and then prunes boilerplate from the document.

### TODOS

* Is it better to have annotate return the best element, or to find it again here? Returning best element avoids need for querySelector call but it also locks in the boilerplate API (reduces flexibility).
* Optimize pruning to use fewer calls to contains, use the special node function that checks for relation between two nodes
* Maybe annotate should add a disconnected attribute during annotation and then scoring doesn't need to do any special tests per element, it could just find and remove all disconnected elements using querySelectorAll
