## You Don't Know Node.js
Notes from Azat Mardan's presentation at JSConf Iceland 2016

__

Why use Node.js?

Input/output is one of the most expensive type tasks (> CPU-Bound)
This could be anything from writing to the database, making a request to a server or a third party service, or doing anything in which we are just waiting for a process to complete.

Node has a non-blocking I/O

The easiest way to visualize this is through the following examples:

__Example 1: Java__
```java
System.out.println("Step 1: Not blocked");
Thread.sleep(1000)
System.out.println("Step 2: blocked")
```

In the above example, when the thread is put to sleep the execution of the following line is blocked until the sleep timer has expired.

__Example 2: JS__
```javascript
console.log("Step 1: Not blocked");
setTimemout(function() {
    console.log("callback event");
}, 1000);
console.log("Step 2: Not blocked");
```
In the above example, the callback function is scheduled for the future, more specifically it is scheduled to fire whenever the timeout's timer has expired. 

Once the callback has been registered to the future event, the code continues to execute, and the second console.log fires without being blocked. 
</br>

