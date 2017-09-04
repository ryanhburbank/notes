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

