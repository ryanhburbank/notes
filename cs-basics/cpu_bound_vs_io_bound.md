__CPU Bound vs I/O Bound__
___

Examples of CPU Bound:

* scientific computation
* (in-memory) data analysis
* simulations

Examples of I/O Bound:

* reading from / writing to disk
* accessing camera, microphone, other devices
* reading from / writing to network sockets
* reading from stdin

</br>

Doing I/O is a kernal space operation, intiated with a system call, so it results in a privledge context switch.

When an I/O operation is requested with a blocking system call, we are talking about blocking I/O.

This can deteriorate concurrency under implementations, concretely those that use many-to-one mapping. This means that all threads in a process share a common kernel thread, which implies that every thread is blocked when one does blocking I/O (because of the above-mentioned switch to kernel mode).

No wonder that modern OSes don't do this. Instead, they use one-to-one mapping, i.e. map a kernel thread to each user-space thread, allowing another thread to run when one makes a blocking system call, which means that they are unaffected by the above adverse effect.

</br>

Doing I/O usually consists of two distinct steps:

</br>

__Checking the device__:

* blocking: waiting for the device to be ready, or
* non-blocking: e.g. polling periodically until ready, then

</br>

__Transmitting__:

* synchronous: executing the operation (e.g. read or write) initiated by the program, or
* asynchronous: executing the operation as response to an event from the kernel (asynchronous / event driven)

</br>

__Example 1:__

Imagine you are moving to a new apartment, below are three techniques for executing the move.

__Synchronous, blocking I/O:__

1. Load your stuff into boxes and drive it yourself to the new apartment, possibly getting stuck in traffic along the way.
2. repeat step 1 until all your stuff has been moved.

</br>

__Synchronous, non-blocking I/O:__

1. Load your stuff into boxes.
2. check the road for traffic, and only move your stuff over if the road is clear.
2. repeat step 1 & 2 until all your stuff has been moved.

</br>

__Asychronous, non-blocking I/O:__

1. Hire a moving company to both load and move your stuff.
2. They will periodically ask if there is more stuff to move.
2. The moving company notifies you when finished.

</br>

__Drawbacks to sync / blocking I/O:__

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