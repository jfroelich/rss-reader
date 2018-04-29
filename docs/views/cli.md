# cli
Exports several functions to the `window` object in order to make those functions available in the browser's `console`. The cli is another interface to the app's functionality in addition to the normal graphical user interface (GUI). Basically another type of view.

Given its low usage rate, there is not much here that cannot be done outside of the GUI. The reason this module exists is mostly to retain access to certain functionality as the GUI goes in and out of a stable state. A second reason is to reinforce a design constraint on the app's modular architecture, in that I want to clearly delineate between what is part of the view and what is part of the model. By having multiple styles of consumers (e.g. view-like modules that request information from the store and send commands to the store), it forces the design of the store to work headlessly, and ensures that functionality that is not view-specific does not somehow end up in the view (a design mistake I perennially experience).

A relatively unique characteristic of this module is that it does not export identifiers to the importing module. This module only exports to the global window object. This module is not intended to be testable. The functions in this module are not intended to be called by other functions in other modules.