## Node's Event Loop
Notes from Sam Robert's Presentation at NodeJs Interactive

<br>

***
**What is a node's event loop?**

A semi-infinite while loop, calling epoll wait *(or __pull_wait__ or __k_q_wait__ or whatever the system call is)* on the kernal, and blocking until something interesting occurs.

When something interesting occurs, node then transforms that into a javascript API, which might manifest as an event, a callback, the FS module, etc.

*A semi-infinite while loop, polling and blocking on the O/S until some in a set of file descriptors are ready.*

***When does node exit?***
If there are no events, epoll_wait will never give you an event, 
so it will either always return immediately, so you busy loop or it will block forever (which is not useful), so node exits.

Node exits when there is nothing to wait on in the epoll_loop.

__Note__: There is also an __*unref*__ call on a lot of node objects.

If you happen to create something that is being epoll waited on, but it is not core to what you're doing and you don't want to keep node alive just because that resource is there, you can __*unref*__ it. 

Which in essence allows you to say I am waiting for this socket, but I will not count it, so if its the only resource I am still waiting on I will exit the loop

*It exits when it no longer has any events to wait for, at which point the loop must complete*

*Note: __.unref()__ marks handles that are being waited on in the loop as "not counting" towards keeping the loop alive*

***Can we poll for all system activity Node.js wants to be notified of? In other words, can everything be async?***

*aka is everything in the node api epollable?*

Yes and no, there are basically three classes of things:
1. Pollable file descriptors: can be directly waited on (aka epollable)
2. Time: next timeout can be directly waited on (aka epollable)
3. Everything else: must happen off loop, and signal back to the loop when done

**Pollable: sockets (net/dgram/http/tis/https/child_process pipes/stdin,stdout,stderr)**

*well supported in the node api*

**Pollable: time (timeout and intervals)**

*__timeout__ resolution is milliseconds, __timespec__ is nanoseconds, but both are rounded up to system clock granularity. 
 Only one timeout at a time can be waited on, but Node.js keeps all timeouts sorted (from the next to occur to the last to occur), and sets the timeout value to the next one*

 *every time epoll is called, node looks at the next timeout and sticks it in epoll*

 **Not Pollable: File System**
 
 *Everything in fs.* uses the uv thread pool (unless they are sync)*

 *The blocking call is made by a thread, and when it completes, readiness is signaled back to the event loop using either an eventfd or a self-pipe*

 *You also cannot wait on threads in an epoll loop*

 **Aside: self-pipe**
 
*A pipe, where one end is written to by a thread or signal handler, and the other end is polled in the loop.  Traditional way to "wake up" a polling loop when the event to wait for is not directly representable as a file descriptor*

*In layman's terms, you create a pipe with two ends, when a thread finishes, it writes a byte through the pipe, and the other end of the pipe is being waited on in the epoll_loop and the epoll_loop wakes up.*

*When you something that is asynchronous or something off the main loop and you want to wake the main loop up, a self pipe is an option*

**Sometimes Pollable: DNS**

* *__dns.lookup()__ calls __getaddrinfo()__, a function in the system resolver library that makes blocking socket calls and cannot be integrated into a polling loop.  Like __fs.\*__, it's called in the thread pool.*
* *__dns.\<everything else>__ calls functions in c-ares, a non-blocking DNS resolver and integrates with the epoll_loop, __not__ the thread pool.

Docs bend over backwards to explain how the two differ, but now that you know that blocking library calls must be shunted off to the thread pool, wheraas DNS queries use TCP/UDP sockets and can integrate into the event loop, the distinction should be clear.

The system resolver for host names does not necessarily use DNS, there is a host file you can directly write to, there is multicast DNS, there are a lot of ways of resovling host names.

 If you want the system to resolve hostnames, you need to call get host by addr (or getaddrinfo), which is blocking, and thus uses the thread pool.
 
 Everything else in DNS is async, so it is safe if you want to stay out of the thread pool, but note that __getaddrinfo is the default__.
 
 Doing something common, like __HTTP get__ or __TCP connect__ , in which you give a host name, will go through the thread pool for the DNS lookup.

**Important notes about the UV thread pool**

It is shared by:
* fs,
* dns (only dns.lookup()),
* crypto (only crypto.randomBytes() and crypto.pbkdf2())
* http.get/request() (if called with a name, dns.lookup() is used),
* any C++ addons that use it

Default # of threads is 4, significantly parellel users of the above should increase the size.

While the thread pool is useful, its limited number of threads means that if you are running thousands of concurrent connnections, and each of them is doing a DNS lookup or file system activity, they will hit contention for the thread pool and you will find your preformance dropping through the floor.


Hints: 

* Resolve DNS names yourself, using direct APIs to avoid dns.lookup(), and stay out of the thread pool
* Increase the size of the thread pool with UV_THREADPOOL_SIZE

**Pollable: Signals**

The ultimate async... uses the self-pipe pattern to write the signal number to the loop.

Note that listening for singals doesn't "ref" the event loop, which is consistent with signal usage as a "probably won't happen" IPC mechanism.

**Pollable: Child Processes**

* Unix signals child process termination with SIGCHLD
* Pipes between the parent and child are pollable

**Sometimes Pollable: C++ addons**

Common source of problems

Adds should use the UV thread pool or integrate with the loop, but can do anything, including making loop blocking system calls when they should instead use the thread pool. 

Hints: 
* Review addon code
* Track loop metrics
* If loop time is in the 100s of milliseconds, you are either doing CPU intensive activity, or you are blocking

<br>

***
**Is node single threaded or multi-threaded?**
Node's main event loop is single threaded, but the work it passes off (network, disk, file system, etc) is multithreaded.

_(bonus question: when?)_

<br>

***
**Why is Node said to "Scale Well"?**

Low resource cost per connection

<br>

***
**A Primer in Unix System Programming**

Network connections use "sockets", named after the system call used:

```c
    int s = socket();
```

socket descriptors are often referred to as "file descriptors". A file descriptor can refer to a socket (as in this case), or other things.

 _* (this can be confusing, as file descriptors in this case are not references to the file system)_

File descriptors are O/S "object orientation", they point to objects in the kernal with a virtual "interface" (read/write/close/poll, etc)

Essentially, it is the system's means of achieving object oriented abstraction.

* A File descriptor is an integer offset into an array that's kept in the kernal, every process has an array of file descriptors, 
* that array has a pointer to an object, which is the open/control block for whichever resource is attached to the file descriptor. 
* That resource(?) has a pointer to a virtual function table, it allows things like sockets, files, pipes, to all support a common interface, but with different functionality depending on what the underlying resource is.
    * _Example: read can be called on sockets, pipes, and files, but thropugh the virtual function table, but will also different functionality depending on the context_

 
__Scale Problem: thread-per-connection (aka thread-per-socket)__

Below is a classic example of implementing TCP Servers with a thread per socket
```c
    int server = socket();
    /*
    we create a socket and assign its file descriptor to server 
    */

    bind(server, 80)
    /*
    we then bind that socket to a port 80
    */

    listen(server)
    /* we then call listen to begin accepting connections */

    while(int connection = accept(server)) {
        /* we accept connections by calling the system call accept */
        pthread_create(echo, connection)
        /* we create a new thread, passing it an echo server (function pointer) and the incoming socket's file descriptor */
    }

    void echo(int connection) {
        char buf[4096];
        while(int size = read(connection, buffer, sizeof buf)) {
            write(connection, buffer, size);
        }
    }
```
_* (Until we call listen, the socket we have created could be used for either accepting connnections or making connections)_

_System calls can block, and blocking system calls are effectively our library calls into the system_
* _If you ask the kernel to do something for you that it can't do for you right away or that is going to take a little bit of time, the kernal will deschedule your process, so you can't take anymore CPU or get anymore CPU,_

* _Sometime later, when whatever you asked for is ready or complete, your process will get scheduled again_

This is great when you don't want to use CPU, but it is not good if you want or need to do something else, and in particular it is not good if you want to handle multiple connections at the same time. 

In thread per connection model, 
1. we call accept, 
2. accept blocks, 
3. when the TCP connection arrives, it unblocks, 
4. you now have a new socket, that is specifically for the TCP client,
5. You could now start reading and writing to that socket, but if you did so you wouldn't be able to accept any more connections.
6.  To account for this, we then put the socket into a thread, through the following steps:
    + you call `pthread_create`, pass it a function pointer, pass it your socket file descriptor, and that thread function can now start, 
    + the new thread contains an echo server that can read data from the socket and write data back out the socket
7. The loop then continues, which each new connection spinning off its own silent thread.

While this does work, on older systems, such an architecture would lead to system failures after a few hundred to a few thousand silent threads had been created.

Today, while operating systems are significantly improved, and can handle several thousand threads simultaneously, the fact remains that threads are a relatively heavy solution given the amount of data we need per connection.

After all, all we really need to know to talk to a client is its' socket descriptor and what we intend to do with that descriptor (the function pointer). (which only requires roughly a dozen bytes of memory).  

To spin up an entire new operating system resource just to handle a single socket, __doesn't scale well__, and particulary not with tens of thousands of connections.

There is a better solution:

__Scale Solution: epoll -setup__
```c
    int server = socket();
    bind(server, 80)
    listen(server)
    /*
    we now have a socket file descriptor
    we are only interested in an incoming TCP connection
    */

    /* we create an epoll file descriptor */
    int evenfd = epoll_create1(0);

    struct epoll_event ev = { .events = EPOLLIN, .data.fd = server};

    /* 
    we add the epoll file descriptor to the epoll loop
    and we specify that we are interested in when there are incoming TCP sockets
    */
    epoll_ctl(epolldf, EPOLL_CTL_ADD, server, &ev);

    struct epoll_event events[10];

    // This is the "event loop", each loop could be called a "tick" of the loop, but then it would be confused with process.nextTick()

    while((int max = epoll_wait(eventfd, events, 10))) {
        /*
            we call epoll_wait, at which point we block and are descheduled and no CPU will be taken or given

            When the kernal sees something we were interested in happen (such as an incoming TCP socket),
            It schedules the process again
        */

        for(n = 0; n < max; n++) {
            if (events[n].data.fd.fd == server) {
                // Server socket has connection!
                int connection = accept(server);
                /*
                we have not a socket file descriptor for the TCP client
                though we may not have any data
                just because it's connected doesn't mean it's sent anything
                */

                ev.events = EPOLLIN; ev.data.fd = connection;
                epoll_ctrl(eventfd, EPOLL_CTL_ADD, connection, &ev);
                /*
                so we add the client socket to the epoll loop
                saying that we would like to now when there is data available in the client socket

                once added, we wait again and are descheduled
                but we will now be scheduled again when either we receive a new TCP connection, or there is data available on of specific TCP connecction
                */
            } else {
                // Connection socket has data!
                char buff[4096]
                int size = read(connecction, buffer, sizeof buf);

                /*
                if there is data on a specific TCP connection,
                we can then begin echoing so we can read that data out of the connection and then write it out to the client
                */

                write(connection, buffer, size);
                //note the above is a simplification,
                
                /*
                just because we can read from a socket does not mean we can write to it, rather we would need to read from the socket, store that data in memory, and then add again the epoll_loop to listen for the socket to be writable, at which point we could then write to it with our stored data
                */

                //there is a lot of bookeeping involved, with race conditions and subtlety abound
                //which is why many use libuv
            }
        }
    }
```
**(__epoll__ is used in Linux, __kqueue__ on BSDs is similar, while Windows has a different api with the same end result)*

_we use the epoll file descriptor to tell the kernal about the things we are interested and the kernal is going to use it to tell us when things happen that we asked about_






