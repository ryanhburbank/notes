__Thread:__

A thread is the default unit of CPU usage.  Code executed in a single thread is what we refer to as a synchronous execution.

Threads can be created with system calls, and each thread has the following:

* a call stack
* a virtual cpu
* (often) local storage

</br>

Threads share the application's heap, data, codebase, and resources (such as file handles), with all other threads in the process.

Threads also serve as the unit of scheduling in the kernal.
For this reason they are called *kernal threads*, which specifies that they are native to the OS and scheduled by the kernal.

*kernal threads* are to be distinguished from *green threads*, also known as *user-space threads*, which are scheduled by a user space scheduler like a library or VM.

Most OS Kernals use preemptive schedules, so we can assume threads are preemptively scheduled, distinguishing them from non-preemptive (aka cooperative) counterparts, called fibers.

</br>

Preemptive scheduling is the reason a hanging process doesn't stall the whole computer.

*Preemption* is the act of temporality interrupting a task being carried out by a computer system, without requiring its cooperation, and with the intention of resuming the task at a later time.

Context switching (switching between threads) is done at frequent intervals by the kernal, creating the illusion that programs are running in parallel, wheras in reality, they are running concurrently but sequentially in short slices.

Processes execution are interleaved with other processes and the OS's execution itself, so the system as a whole remains responsive.
