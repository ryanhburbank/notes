## Everything You Need to Know about Node.js Event Loop
Notes from Bert Belder's Keynote at Node.js Interactive Europe

___

</br>

There are many misconceptions about how Node actually works, and there are numerous blogs and diagrams online that misrepresent Node's architecture:
* There is no non-blocking worker thread pool
* There is no stack of events
* Networking does not happen in the thread pool

</br>

Before we begin understanding how Node should be represented,
we first need to understand some basics.

If you are not used to Node or asynchronous I/O evented programming, you are probably used to something like this:

```c
//IMPORTANT This is pseudo C code, don't expect it to work :)

int fd = socket();
int result = connect(fd, "www.zombo.com", 8080);

if (result == 0) {
    char buf[1024];
    int sent = write(fd, "hello zombo!", 12);
    int received = read(fd, buf, 1024);
}

close(fd)
```

A new developer may think that the above is an intensive process, as you're sending and receiving data to & from the network, but in reality, it is not. But why?

</br>

In the 90s computers learned a trick called __direct memory access__, which works something like this:
1. Whenever your CPU (which runs your program) wants to do something with the hard disk or the network card, 
2. It simply sends a command to some peripheral device and that device then beings to process that action with memory.
3. With the process now being handled by the device, the CPU is then free to do other work.  
4. At the moment the device's work is done, or it needs more data, etc, the device then send an interrupt to the CPU.
5. Upon receiving an interrupt, the CPU immeditately jumps and goes to handle the interrupt (at the cost of forgetting where it was previously) 

</br>

__In Short, Major operating systems have been faking synchronous I/O for years__

In Node.js we have an event loop, which means we can do asynchronous programming, but we don't have to deal with ADD nature of the processor (aka the CPU's tendancy to respond to interrupts and forget what it was doing).

How to we model the event loop? Here is the sequence of events:

*__Note that event emitters are not in the loop__*

1. __index.js__
    * The node event loop always starts with the program, not a callback, but rather whatever is in the entry point of your program (such as index.js or main.js)

2. __setTimeout & setInterval__
    * it will check if there are any timeouts or intervals throught libuv
    * if any are found, it will then go into your javascript and call the appropriate callbacks (callback loop sequenced below)

3. __network & disk & child process__
    * it will check if there is any disk, network, or child process activity through libuv
    * if any are found, it will then go into your javascript and call the appropriate callbacks (callback loop sequenced below)

4. __setImmediate__
    * it will check the setImmediate queue (the queue containing everything you did with setImmediate) through libuv
    * if any are found, it will then go into your javascript and call the appropriate callbacks (callback loop sequenced below))

5. __"close" events__
    * internal phase in which node creates "close" events and cleans up open sockets and other such things

6. __decision point__
    * depending on the context, node & libuv will either continue with another iteration through the loop, or it will proceed to process#exit

7. __process#exit__
    * if node has determined the loop is ready to be terminated, it fires the process#exit event


</br>

#### The Callback Loop
After each check in the event loop, the corresponding callbacks are fired by node.  Each callback in turn begins a mini loop within the broader event loop.

1. A callback is fired.
2. Node starts a loop to check for resolved promises, with the loop running until all promises have been resolved.
3. Node starts a loop to check for nextTick callbacks, with the loop running until all nextTick callbacks have fired.

</br>

__Example 1:__

Suppose that during the check for setImmediate,libuv finds a call and then executes its callback, and that callback fires a setTimeout. The following will then happen: 

1. Node will then add that timer to the timer heap.

2. When the loop has completed its checks, node will determine that another iteration is needed as there are still outstanding events to be handled.

3. On the next iteration, when the loop reaches its check for setTimeouts, node will determine which timeouts have expired and then fire their given callbacks

</br>

__Example 2:__

Suppose that your program creates a server (aka socket), through a call like the following:

```javascript
net.Server.listen()
``` 

As the server is not bound to the thread pool, we go directly to the operating system and say: "give us a notification if a new connection is made to our server"

When the loop tries reaches the network check, it will pick up any new connections made since the last iteration and fire any related callbacks.

Stated in another way, the sequence be as follows:
1. Prior to begining the loop, the js program begins listening to a server
2. The call to listen goes directly to the operating system, and tells the OS to send a notification upon any new connections being made to the server.
3. When the loop begins, and then reaches the network process check, the loop will pick up notifications sent by the OS for new connections, and then execute the related callbacks.

</br>

__Example 3:__
Suppose that during the close event / cleanup portion of the loop, we write to the filesystem during a callback:
```javascript
    fs.WriteStream.write()
```
This call to the fs will cause the system to get a worker thread (there are generally 4 available) and assign to go do the work.  

Upon the work being complete, that worker thread will send a notification, which can then be picked up by the network, disk, & child process check, which will then fire the appropriate callback for that event.

</br>

Stated again in list form:
1. A close event callback fires a write to the file system.
2. The system assigns that write work to one of 4 worker threads.
3. Upon that thread's completion of the work, it sends a notification.
4. That notification is then picked up by the networ, disk, & child process check on the loop's next iteration
5. Upon recieving the notification, the loop then fires any related callbacks.

</br>

__Question: How Does Node know whether to exit or keep looping?__ 

Essentially, everytime the program starts an operation (either through main execution or a callback), the ref count in the heap is incremented up by +1.

When that event's completion is detected by the loop's checks and the callback is fired, the ref count is decremented by -1.

Upon the compleition of a loop, if the count is zero, the loop exits.

</br>

___

### __Aside: How the Network, Disk, and Child Process Function work__

In previous blocking paradigms, requests would be fired and then waited on for a response, after which actions like read and write could occur.

With node, we need to be able to fire off events without immeditately waiting for the result of said events.  

What node's check functions must be able to do is get the result of anything that has finished working in the background.  

As pseudo-code, that functionality would look something like this:
```javascript
function eventLoopCheck() {
    //Put the main thread to sleep.
    //Wake up when:
    //
    // * there are events from the kernal to process
    // * a thread pool thread has completed an operation
    /*
        * the next timer goes off, such as:
         * epoll_wait() {linux}, 
         * kevent(){ apple}, 
         * getQueuedCompleitionStatusEx() {windows}
    */

    // the function also only grabs the next timeout to expire
    // until that timeout triggers, the function returns an empty collection
    // which will cause the event loop to spin until the next expiration
    // return the collected events
}
```

</br>

#### Where Things Happen
* __Kernal__
    * tcp / udp sockets, servers
    * unix domain sockets, servers
    pipes
    tty input
    dns.resolveXXXX

* __Thread Pool__
    * files
    * fs.*
    * dns.lookup
    * pipes (exceptional cases)

* __Signal Handler (posix only)__
    * child processes
    * signals

* __Wait Thread (windows only)__
    * child processes
    * console input
    * tcp servers (exceptional cases)

</br>

Node above all was built for scalability, node can handle thousands of open connections without breaking a sweat.

Whenever possible, Node tries to use the kernal, by asking the OS to send a singal whenever an operation has been completed.

Unforunatley, OS's are not perfect, and files and sometimes pipes have to run in the thread pool.  

Whenever you look up a domain, such as for example "google.com",
the DNS lookup function is called and then run in the thread pool.  This is because the way your computer locates DNS records is operating system specific, and people expect the lookup behavior to match that of the browser, so node has to use the Operating System.

Fortunatley, there are better DNS functions that actually are asynchronous, but they need to be called manually (such as dns.resolveXXXX)

Sometimes signal handlers need to be used.  Signal handlers are similar to interrupts from an architectural perspective, particularly in how they can cause your program to jump to handle it while forgetting its previous context.  For this reason, they are rarely used.  

___
<br>

### Aside: Heap vs Stack
* Stacks are used for static memory allocation and a heap is used for dynamic memory allocation, both stored in RAM

* Use a stack if you know exactly how much data you need to allocate before compile time and it is not too big.

* Use a heap if you don't know exactly how much data you will need at runtime or if you need to allocate a lot of data.

* In a multi-threated environoment, each thread will have its own independent stack, but all threads will share the same heap.  Thus a stack is thread specific, while a heap is application specific.

</br>

__Stack__

* Variables allocated on the stack are stored directly to the memory and access to this memory is very fast, with allocation dealt with when the program is compiled

* When a function calls another function which in turn calls another, the execution of all those functions remains suspended until the very last function returns its value.

* The stack is always reserved in LIFO order, making it simple to keep track of the stack, as freeing a block is nothing more than adjusting one pointer

* As stacks are thread specific, they are important to consider in exception handling and thread execution.

</br>

__Heap__

* Variables allocated on the heap have their memory allocated at run time, and thus accessing this memory is a bit slower, at the benefit of allowing heap size to be limited only by the size of virtual memory.

* Elements of the heap have no dependencies with each other and can always be accessed randomly at any time.

* You can allocate a block at any time and free it at any time. This flexibility comes at the cost of making it much more complex to track which parts of the heap are allocated or free at any given time.


