### How Does Node Work asynchronously without multithreading?
Notes based upon the [blog post of the same name](https://softwareengineeringdaily.com/2015/08/02/how-does-node-js-work-asynchronously-without-multithreading/) by Alex Mills

</br>

___

__Node's event loop is single threaded, but the various processes that it delegates to are not__

The main event loop is single threaded, but the majority of the I/O work (network, disk, etc) is run on seperate threads, which makes sense, as the I/O APIs in Node are designed to be async by design.

In other sense, Node is in a sense not asynchronous at all, as all the code the dev sees is synchronous.  The asychronous behavior is abstracted away by Node's I/O apis.

Because the dev is writing code that is really only running in a single thread in the event loop, that code doesn't need to account for thread saftey and other common headaches associated with multi-threaded architecture.

__Key Takeaway:__

*As long as you don't do CPU intensive work on the main JS thread, you're golden*

This is because slow I/O work is handled by asynchronous non-blocking I/O libraries.

If for some reason you need to do CPU-bound work, __don't put it on the main thread__, instead fork a child_process and run it there.

One should keep in mind, that clienside JS has non traditional I/O, in fact Node was in part created beacause JS had no existing I/O libraries, so they could develop a clean non blocking solution.

For the client, I/O is really only represented through AJAX, which by default is async, otherwise any request would lock up the browser.

As with the client, the same principle holds true in Node. Synchronous/blocking I/O would lock up the event loop, so instead it utilizes asynchronous/non-blocking I/O APIs to allow Node to use background threads to handle the work behind the scenes.

This allows the event loop to continue its iterations, about one each 20 milliseconds.

</br>

___

__Aside: Threads & Processes__

There are of course threads and processes for DB access and process execution.  But these are not exposed to your js program except through I/O interactions in Node's event loop, with the results from each thread being communicated through the event loop to the your program.

When compared to Apache's model, there are fewer threads and less overhead per thread, since threads are not needed per connection, but only when absolutely needed, and even then the thread is entirely managed by Node.

__Example 1:__

A request comes into your server, after which you run a query and do something with the results of that query

```javascript
result = query("Do some stuff");
do_something_with_result(result);
```
The request coming in would cause the creation of a new thread, which would then run the above code.  The thread would then sit and wait for the query to finish executing.

__Example 2:__

Given the same criteria as Example 1, a more Node-esque solution would look like the following:

```javascript
query(statement: "Do some stuff", callback: do_something_with_result);
```

Under the new structure, the main thread can now begin the query and then go do other work, with the understanding that when the work is complete, the thread can then run the callback against the query's result.

Now the thread can start some I/O work and then go handle other work.

Performance is improved versus a traditional multi-thread model as don't have threads or execution stacks waiting around for I/O to return. 

Async I/O for many operations does not use threads while executing.  Instead the calling thread is released as soon as an I/O operation is started and a callback is fired when the I/O operation is finished and a thread is available for it. 

Typically in I/O intensive scenarios the request spend most of the time waiting for I/O to complete.  During this time, in the one thread per request model, the resource tied to the thread (like memory) as unusued.  In the event loop model, the loop thread selects the next event (i.e. the next I/O finished event) to handle, thus meaning the thread is always busy.


### Aside Bound Contexts
* __CPU Bound:__ A program is CPU bound if it would go faster if the CPU were faster, meaning it spend the majority of its time using the CPU (such as for doing calculations)
    * Example: A program that computes new digits of Pi

* __I/O Bound:__ A program is I/O bound if it would go faster if the I/O subsystem were faster. Which I/O system depends on the program.
    * Example 1: A program that reads from a huge file on disk; the bottleneck is reading the data from disk.

    * Example 2: A program that reads and writes to a network.

* __Memory Bound:__ A program is memory bound if its processes exuection time is limited by the amount of memory available and the speed of that memory access.
    * Example: A program that multiplies large matrices will process large amounts of in-memory data.

* __Cache Bound:__ A program is cache bound if the rate at which the program executes is limited by the amount and speed of the cache available.  
    * Example: A program that processes more data than fits in the cache at any one time will be cache bound.

In order of Speed (first being fastest):
1. CPU Bound
2. Cache Bound
3. Memory Bound
4. I/O Bound


### Aside: Relation to Von Neumann Architecture
I/O Bound state has been a known problem since the earliest days of computing.

Under Von Neumann architecture, a logically seperate CPU requests data from maim memory, processes it, and then writes back to results.

The problem arises as since data must move between the CPU and memory along a bus with a limited data transfer rate, there exists a bottleneck.  

This means that the bandwidth between CPU and memory tends to limit the overall speed of computation.  It is thus predicted that it is easier to make the CPU faster then it is to increase the data transfer rate.

Today, the physical seperation between CPU and main memory requires a data bus to move data across long distances of centimeters or more.

*__Bus:__ A bus is a communication system that transfers data between components inside a computer or between computers*

As a general principle: 

*As CPU gets faster, processes tend to get more I/O bound*