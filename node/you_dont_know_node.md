## You Don't Know Node.js
Notes from Azat Mardan's presentation at JSConf Iceland 2016

__

</br>

#### Aside: What is a Buffer?
*_All examples from [Stack Overflow](https://stackoverflow.com/questions/648309/what-does-it-mean-by-buffer)_

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
#### Aside: What is a Cluster?

A cluster consists of a set of connected computers that work together so that they can be viewed as a single system.

Each computer in the cluster has a node set to perform the saem task, as scheduled and controlled by software.

The cluster is usually connected through a fast LAN, with each node (aka computer used as a server) running its own instand of the OS.

Generally each computer in the cluster will use its the same hardware and OS and the others.

Clustering can be used to achieve improved performance and availablity over a single computer, while also between more cost effective then having a single machine of equal speed and availablity to the cluster as a whole
