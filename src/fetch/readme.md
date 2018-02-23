
Provides basic utility functions for using the fetch API.

The primary benefit of using this library instead of directly interacting with fetch is that it provides the ability to timeout. Somehow the designers of the fetch overlooked this extremely important feature. I've read some of the discussions on how to correct this feature and it is just 'not good'. That is a PC way of putting it. Somehow the designers deemed this feature unimportant. I really do not get it. So, to circumvent this design flaw, this uses a technique of racing a timed promise against the fetch promise and throwing an error in the event that the timed promise wins the race.

In addition to that problem, there is still the problem of aborting/canceling the fetch. There is no way to do this. Yet another waste of resources. I read about some talk of cancelable promises but it looks like that went nowhere.

Notably, several of the functions just provide the response and do not go the full distance of parsing the body into an appropriate format. For example, the fetch_html function does not produce an html document. This is because there is sometimes logic that needs to occur between the time of learning of the response details and parsing the body. Forcing the parsing to occur immediately along with the fetch would be a waste because sometimes the logic that follows the fetch indicates the response should be discarded.
