## CS Basics: Definitions

</br>

___

__Process:__

A process is running instance of a computer program

It consists of the following:
* allocated memory which holds the program's code
* the programs data
* a heap for dynamic memory allocation
* and more

</br>

___

__Buffer:__

*_All buffer examples from [Stack Overflow](https://stackoverflow.com/questions/648309/what-does-it-mean-by-buffer)_

Buffers are required when producers and consumers produce &consume at different rates.

Stated again, it is a place to store something temporarily, in order to mitigate differences between input and output speed.  
* When the producer is faster then the consumer, the producer can continue to store output in the buffer.  

* When the consumer is faster, it can read from the buffer.

</br>

__Example 1:__

Imagine you are eating candy out of a bowl, taking one piece at at time.  To prevent the bowl from running out, someone may refill the bowl from the candy bag before you run out.

__Example 2:__
When watching netflix, netflix is continually downloading the next 5 or so minutes into your local buffer, so as to prevent downloading the movie in realtime

</br>

When talking about system buffers specifically, a buffer is simple a chunk of memory used to hold data.

It is usually a single blob of memory that is loaded in one operation, and then emptied in one or more operations.

__Example 3:__

```c
#define BUFSIZE 1024
char buffer[BUFSIZE];
size_t len = ;

// here the buffer array is used to store data read by read()
// until it is written, after whcih the buffer is reused
while((len = read(STDIN, &buffer, BUFSIZE)) > 0) {
    write(STDOUT, buffer, len);
}
```

</br>

___

__Cluster:__

A cluster consists of a set of connected computers that work together so that they can be viewed as a single system.

Each computer in the cluster has a node set to perform the saem task, as scheduled and controlled by software.

The cluster is usually connected through a fast LAN, with each node (aka computer used as a server) running its own instand of the OS.

Generally each computer in the cluster will use its the same hardware and OS and the others.

Clustering can be used to achieve improved performance and availablity over a single computer, while also between more cost effective then having a single machine of equal speed and availablity to the cluster as a whole

</br>

___

__Thread:__

A thread is the default unit of CPU usage.  Code executed in a single thread is what we refer to as a synchronous execution.

Threads can be created with system calls, and each thread has the following:
* a call stack
* a virtual cpu
* (often) local storage

Threads share the application's heap, data, codebase, and resources (such as file handles), with all other threads in the process.

Threads also serve as the unit of scheduling in the kernal.
For this reason they are called *kernal threads*, which specifies that they are native to the OS and scheduled by the kernal.

*kernal threads* are to be distinguished from *green threads*, also known as *user-space threads*, which are scheduled by a user space scheduler like a library or VM

Most OS Kernals use preemptive schedules, so we can assume threads are preemptively scheduled, distinguishing them from non-preemptive (aka cooperative) counterparts, called fibers.

Preemptive scheduling is the reason a hanging process doesn't stall the whole computer.

*Preemption* is the act of temporality interrupting a task being carried out by a computer system, without requiring its cooperation, and with the intention of resuming the task at a later time.

Context switching (switching between threads) is done at frequent intervals by the kernal, creating the illusion that programs are running in parallel, wheras in reality, they are running concurrently but sequentially in short slices.

Processes execution are interleaved with other processes and the OS's execution itself, so the system as a whole remains responsive.


__CPU Bound vs I/O Bound__

Examples of CPU Bound:
* scientific computation
* (in-memory) data analysis
* simulations

Examples of I/O Bound:
* reading from / writing to disk
* accessing camera, microphone, other devices
* reading from / writing to network sockets
* reading from stdin

Doing I/O is a kernal space operation, intiated with a system call, so it results in a privledge context switch.

When an I/O operation is requested with a blocking system call, we are talking about blocking I/O.

This can deteriorate concurrency under implementations, concretely those that use many-to-one mapping. This means that all threads in a process share a common kernel thread, which implies that every thread is blocked when one does blocking I/O (because of the above-mentioned switch to kernel mode).

No wonder that modern OSes don't do this. Instead, they use one-to-one mapping, i.e. map a kernel thread to each user-space thread, allowing another thread to run when one makes a blocking system call, which means that they are unaffected by the above adverse effect.

Doing I/O usually consists of two distinct steps:

__Checking the device__:

* blocking: waiting for the device to be ready, or
* non-blocking: e.g. polling periodically until ready, then

__Transmitting__:

* synchronous: executing the operation (e.g. read or write) initiated by the program, or
* asynchronous: executing the operation as response to an event from the kernel (asynchronous / event driven)

__Example 1:__

Imagine you are moving to a new apartment, below are three techniques for executing the move.

__Synchronous, blocking I/O__:
1. Load your stuff into boxes and drive it yourself to the new apartment, possibly getting stuck in traffic along the way.
2. repeat step 1 until all your stuff has been moved.

</br>

__Synchronous, non-blocking I/O__:
1. Load your stuff into boxes.
2. check the road for traffic, and only move your stuff over if the road is clear.
2. repeat step 1 & 2 until all your stuff has been moved.

</br>

__Asychronous, non-blocking I/O__:
1. Hire a moving company to both load and move your stuff.
2. They will periodically ask if there is more stuff to move.
2. The moving company notifies you when finished.

</br>

__Drawbacks to sync / blocking I/O__
* every thread allocated uses up resources
* more and more context switching occurs between threads
* the OS has a max number of threads

</br>

___
#### Polling vs Busy-waiting

Busy-waiting is the act of repeatedly checking a resource, such as I/O for availability in a tight loop.

Polling is distinguished from a tight-loop by the absence of a tight loop.

__Example 1: Tight Loop (aka Busy-Waiting)__
```javascript
// tight-loop example
while (pthread_mutex_trylock(&my_mutex) == EBUSY) { }  
// mutex is unlocked
do_stuff();  
```
</br>

__Example 2: Polling__:
```javascript
// polling example
while(pthread_mutex_trylock(&my_mutex) == EBUSY) {  
  sleep(POLL_INTERVAL);
}
// mutex is unlocked
do_stuff();
```
</br>

In the second example, the sleep function puts the current thread of execution to sleep, yielding control of the kernal to schedule something else to run.

Both examples turn non-blocking code into blocking code, as control won't pass the looop until the mutex is freed, thus `do_stuff` is blocked.

</br>

__Example 3: Event Loop__

Imagine we have more mutexs and other I/O devices that can be polled. By assigning handlers to be called when the resource is ready, control-flow is inverted.  By periodically checking the resource in the loop and execute said handlers on completion, we have implemented an event loop.

```c
pending_event_t *pendings;  
completed_event_t *completeds;  
struct timespec start, end;  
size_t completed_ev_size, pending_ev_size, i;  
long loop_quantum_us;  
long wait_us;

// do while we have pending events that are not yet completed
while (pending_events_size) {  
  clock_gettime(CLOCK_MONOTONIC, &start);
  // check whether they are completed already
  for (i = 0; i < pending_events_size; ++i) {
    poll(&pendings, &pending_ev_size, &completeds, &completed_ev_size);
  }
  // handle completed events, the handlers might add more pending events
  for (i = 0; i < completeds_size; ++i) {
    handle(&completeds, &completed_ev_size, &pendings, &pending_ev_size);
  }
  // sleep for a while to avoid busy waiting
  clock_gettime(CLOCK_MONOTONIC, &end);
  wait_us = (end.tv_sec - start.tv_sec) * 1e6 + (end.tv_nsec - start.tv_nsec) / 1e3 - loop_quantum_us;
  if (wait_us > 0) {
    usleep(wait_us * 1e3);
  }
}
```


