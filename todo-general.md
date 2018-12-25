Reorganization of modules. Instead of every module being in the main space, modules that are in use only by other modules should be submodules of those other modules. The only top level modules should be the shared modules or truly orthogonal modules. I want to think and learn more about module locality. I think a better way to state this is that I want a deeper hierarchy. Instead of having all modules exist in the highest level of the hierarchy, I want to nest modules within subfolders to limit the visibility of the module. The idea is that a module is only visible (by convention not syntax) to its ancestors in this hierarchy. It is not visible to its descendants, and it is not visible to modules that are siblings of its ancestry. In other words I am basically grouping dependencies. From bottom up point of view this is recursive grouping.

If a module is only used in one place, it should only be located within that one place. It should (by convention) not be accessible everywhere.

By making things not accessible everywhere, it reduces the surface area of the API, if you view the list of folders in /src/ as the API. The fewer things there are to look at, the simpler it is to understand.

By grouping things used together, then when it comes time to change something, almost all the code that needs to be changed resides in one place. Which, I think, is a good thing? Not entirely sure that it is bad. The layering of functionality, like db layer versus view layer, that makes a ton of sense to me, so it is confusing to see how else to organize it.

Furthermore, there is the diagonal issue, what happens when a dependency needs to be used by two separate things? No choice but to make it a top level module. Even though its character is wholly inconsistent with the character of the other top level modules. For example some tiny utility file is going to be sitting right next to the all powerful app module. The reasoning as to why those two are collocated at top level is not obvious. If I look around, almost no one is doing that. Why?


This has a lot of counter-intuitiveness to it. For example, the logical cohesion of string-utils.js. It is extremely tempting to just group string related functions together in a module that provides string related functions. But this is not functional cohesion, which is supposedly a stronger version of cohesion, where things are grouped together based on use, not type. The reference to use here may be my simplified understanding of feature. I may be aiming for what is termed feature-oriented modular composition just without really understanding what I am doing.



* deprecate database cleaning alarms
* in cron, separate out deprecated alarms, the deprecated flag prop feels wrong
* move old notes back into github repository
* get documentation into more of a working shape with markdown files
* maybe move tests back into separate folder
