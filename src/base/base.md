# About base
This is the infrastructure layer of the app. This folder contains generic, independent modules that upper layers of the app rely upon. For the most part, the modules within the base layer involve little to no knowledge of app policy or concerns. Each module here, if not sourced from a third party, should be designed as a generic library that would be droppable into any other project.

As is common to all the layers, no module in this layer should rely upon higher up layers. This is the *lowest* layer of the app.

To a large extent, each of the modules here should be independent. There should be extremely little if any reliance on other modules. If there is a strong coupling between two library modules, and the independent module has few if any other dependent modules, that is a sign of incomplete design. The independent module should probably be merged into the dependent module and reoriented.

# A note about app-specific libraries versus generic libaries
It is quite possible I need to rethink this and introduce a large division between 'generic libraries that are heavily tailored towards this app' and 'truly generic libraries'. For example, maybe I want a lib folder for generic libs, and a base folder for app-specific but low level libs.

A good example of this is the 'fetch2' module. It is kind of app-specific at the moment, more than what I would like. It would be better if I made two libraries. A generic fetch that just introduces basic stuff like timeout, and then an app specific fetch, that wraps the generic fetch and introduces other stuff like fetch policy.

Otherwise, where would the app-specific version go?
