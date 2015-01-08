# Zed.js

## Statically typed object representation

supports ints, floats, strings (inefficient), lists of ints and lists of floats  
(note: This was started 2013-11-14, and no future work is planned. Static memory management is hard.)

### The Web Worker data problem

Web Worker pass-by-reference only works with typed-array objects.
Stringifying JSON is far too expensive, so ZedObjects can be used instead, 
which are backed by a static memory representation which can be passed to Web Workers directly.


### Usage

```js
// usage
var z = new Zed({
  num: 1,
  float: 2.3,
  string: 'abc',
  arrInt: [1, 2, 3],
  arrFloat: [1.2, 1.3, 1.4],
})
console.log(z.num) // 1
z.num+=1
console.log(z.num) // 2
z.num = 10
console.log(z.num) // 10
console.log(z.float) // 2.3
z.float += 1.1
console.log(z.float) // 3.4
z.float = 0.1
console.log(z.float) // 0.1
console.log(z.string) // abc
console.log(Array.apply([], z.arrInt)) // [ 1, 2, 3 ]
z.arrInt[0] += 100
console.log(Array.apply([], z.arrInt)) // [ 101, 2, 3 ]
console.log(Array.apply([], z.arrFloat)) // [ 1.2. 1.3, 1.4]
z.arrFloat[0] += 100
console.log(Array.apply([], z.arrFloat)) // [ 101.2, 1.3, 1.4]
```
