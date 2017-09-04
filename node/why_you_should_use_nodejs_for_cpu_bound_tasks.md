## Why You Should Use NodeJS for CPU Bound Tasks
notes from the [blog post of the same name](http://neilk.net/blog/2013/04/30/why-you-should-use-nodejs-for-CPU-bound-tasks/) by Neil Kandalgaonkar

</br>

___
### The Question: Can Node be used for CPU bound tasks?

The Scenario: Imagine you have a web service in Node that can be broadly divided into two sections:

1. In the first, you need to compare a word against a large dictionary of possible words held in a __large amount of memory__. The lookup itself takes __little time__. The word itself is sent to the server from the client and read in as an input.
2. in the second, if the word is valid, you then use it as the input for a computationaly intensive calculation, that requires __little memory__ but __lots of time__.

</br>

The issue: While client requests are relatively fast with a few users, the app fails to scale, as the long computational time per request kills performance.

__But Why?__:

*  Node can only process one requests at a time.  This is generally not a problem, as most web apps do little in the way of computation.  

* Rather, they spend the majority of their time waiting for other services to return messages to them (databases, sockets, read/write to the file system, etc).  

* Node is in fact built for such events, as its event loop allows it to simply fire off requests and then deschedule the process until a response is received.

* CPU intensive events cannot take advantage of this event loop, as their is nothing to delegate to other parts of the system.  Instead, the JS work being done is not minimal, but complex enough to block other users until the work is complete.

* Such tasks are called __*CPU-bound*__, versus the the tasks of the average site which we would classify as __*I/O-bound*__ 

</br>

___

__Example 1:__

Imagine a image filtering app like instagram written in Node.  There is little in the way of I/O.  The image processing itself is CPU intensive; from Node's perspective, there is no opportunity to pass off the task.

</br>

___

#### Possible Solutions

__Solution 1: Forcing yield to next waiting process__

While Node generally waits for async I/O to yield to next waiting process, you can force the action through `process.nextTick` or `process.setImmediate`

Unfortunately, certain calls like using `sort` on an array of a million+ items are blocking by definition, short of re-writing the function itself in pure JS.

</br>

__Solution 2: Threads & Forks__

By leaving Node's bubble, we can access the rest of the OS, where processes can share resources without having to know about one another. 

With this solution, the event loop can pass off complicated work to workers and then forget about the worker until the work is complete

For web servers like Apache, *forking* is the classic solution.  Forking can be used to create multiple isolated copies of the program, which all mostly resuse the same areas of memory in the heap. Thus multiple forks can run at once, with the death or freezing of one not effecting the others. 

In Java, *threading* is the go-to solution. With threading, there are multiple paths of execution managed with the same program, with data structures held in common.

In Node, __neither forking or threading__ is possible :-)

</br>

__Solution 3: Worker Pools__

Node features a `child_process.fork` function, which is not a true fork.  Instead it is a *fork and exec*, in which a entire new node process is started, but with no shared resources between the node processes (other then a few aspects of the ENV). 

On the plus side, this does provide a worker, in a seperate process, managed by the OS.  Such *worker pools* can be handled through node libraries such as __[backgrounder](https://github.com/jolira/backgrounder)__

__Aside: Memory limitations__

* Free online hosting services like __digital ocean__ and __heroku__ will generally only provide a single dyno with limited memory (around __500MB__).  

* A complex node app with external libraries can easily push __200-300MB__, meaning that spinning up even a single child_process can push you past memory limits. 

</br>

__Solution 3: Clustering__

Using the `cluster` module, we can wrap the app inside a traditional forking structure (if parent, do nothing; if child, start service)

Through this architecture you can spin up five to seven workers, though you run into scaling issues as you can't scale a forked server across machines, and you need a load balancer to direct requests to different forks.

</br>

__Solution 4: Worker Pools, Hybrid Approach__

* As we know that the app's lookup against the dictionary is memory intensive but a very fast operation, we can call it ___I/O-Bound___.

* The CPU intensive calculation is neither data or memory intensive, it only requires to execute.  As such, it is ___CPU-Bound___

With this in mind, we can limit the main loop to handling word lookup against the dictionary, while the workers are dispatched the CPU intensive work.

Workers can be expected to grow to large sizes in memory during their operations, but will quickly revert to their original size following GC.

An unforuntate side effect is the amount of serializiation and deserialization taking place as the server sends and recieves data to & from its' workers.

</br>

__Solution 5: Threads, Hybrid Approach__

While the worker pool can work, memory fluctuations within the workers can be problematic is memory limited environments (free Heroku apps, for example).

Threads offer a possible alternative, using libraries like `threads_a_gogo`.  

Though threads are in the same process, they communicate using serialized data, and you may `eval` code in them to call their APIs.  they don't share data, and each needs to be a solid block of pure JS, with libraries concated into the block using tools like `browserify`.

While we are limited from loading a lot of code or data due duplication in each thread, overall memory usage is lower then pools, with a stable memory footprint, most likely due to memory holding the serialized JSON as it enters and leaves the threads.

One major downside is error handling; a haywire thread can only be killed by stopping the entire server :-(

</br>

__Solution 6: Running on the Client__

As a rule of thumb, we don't want to run large codebases or memory intensive applications on the client, as each would require large (and thus time-intensive) downloads to the client.

However, computationaly heavy code can be run on the client for two reasons:
1. Modern browser JS implementations are just as fast as Node.

2. Web workers allow us to parallelize the work to other threads on the browser, without blocking the user's experience with the site.
    * in many ways, Web Workers are analogous to ordinary HTTP requests that might handle with XHR, except that they are handled locally.

Web Workers have the same functionality as browser JS, with the exception of not being allowed to touch the DOM.  As with all client side code, bundling is required, so a tool like `browersify` must be used for any external libraries. 

To handle browsers that do not support Web Workers we take the following steps:

1. We test for the presence of Web Workers in the given browser.

2. If there are Web Workers, we have them handle the CPU intensive work, while the server handles the I/O bound work.

3. If not, the server handles everything. 

In essence, this solution is farming out CPU intensive work to other threads, and if possible, threads on the client's browser itself.

The downside of the approach is an increase in I/O, as the server is now sending large volumes of JSON (for valid words) to the browser (rather then handling everything itself).

Web Worker threads can also be used for CPU intensive massaging of database search results from the server, such as sorting or pagination.

</br>
___

#### Aside: Cooperative Multi-Tasking
Every process needs to voluntarily give up full control of the computer so everyone can get their work done.  

Today, every OS shares resources among tasks automatically.

In node, such cooperative tasking in implicit, based on whether or not I/O is expected to happen soon. This means that a CPU intensive task will prevent Node will acting cooperatively.