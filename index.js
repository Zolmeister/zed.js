// data types
// String, Number, Boolean, Array, Object, Null, Undefined
function Zed(obj) {
  // first, lets estimate how much memory we will need for the object
  var initialSize = Math.max(this._Zed.nextPowerOf(this._Zed.sizeOf(obj), 2), 2)
  this._Zed.mem = new ArrayBuffer(initialSize)
  this._Zed.dataView = new DataView(this._Zed.mem)
  this._Zed.intView = new Int8Array(this._Zed.mem)
  this._Zed.size = initialSize
  this._Zed._self = this
  
  // this is the next available index in our ArrayBuffer, in 8bit chunks
  this._Zed.lastIndex = 0
  
  // now lets iterate the values of the object, adding them to the array buffer
  for(var key in obj) {
    this._Zed.add(key, obj[key])
  }
}
Zed.prototype._Zed = {
  
  // when we add items we keep track of position and type with a map
  // position and type are both stored in 1 32bit signed int, where 
  // encoding:   [0](sign) [1:4] (type: String, Number, etc.) [4:] (index: max index is 268,435,456)
  map:{},
  typeMap : {
    'string': 0,
    'integer': 1,
    'float': 2,
    'boolean': 3,
    'array': 4,
    'object': 5,
    'null': 6,
    'undefined': 7
  },
  typeMapInverse : {
    0: 'string',
    1: 'integer',
    2: 'float',
    3: 'boolean',
    4: 'array',
    5: 'object',
    6: 'null',
    7: 'undefined'
  },
  encodePos: function(index, type) {
    var typeNum = this.typeMap[type]
    // encoding:   29bits (byte Offset: max val is 536,870,912) - 3bits (type)
    // decode: encoded & 7 == type, encode >>> 3 === index
    return index << 3 | typeNum
  },
  encodeArrKey: function(length, type) {
    // encoding: 29bits (array length: max val is 536,870,912) - 3bits (type)
    return length << 3 | this.typeMap[type]
  },
  typeOf: function(val) {
    if (val === null) return 'null'
    if (val instanceof Array) return 'array'
    if(typeof val === 'number') return val%1 === 0 ? 'integer': 'float'
    return typeof val
  },
  add: function(key, val, type, size) {
    type = type || this.typeOf(val)
    size = size || this.sizeOf(val)
    // add the key for the value to our key map
    this.map[key] = this.encodePos(this.lastIndex, type)
    
    // set next index position for next addition
    // align to 4 bytes
    if(size%4!==0) size += 4-size%4
    this.lastIndex += size
    
    // check if need to grow memory
    while(this.lastIndex * 4 > this.size) {
      // grow memory
      var newSize = Math.pow(this.size, 2)
      /*var newBuffer = new ArrayBuffer(newSize)
      var copyView = new Int8Array(newBuffer)
      copyView.set(this.intView)
      this.intView.buffer = copyView.buffer
      this.dataView.buffer = copyView.buffer
      this.mem = copyView.buffer
      console.log('set mem buffer')*/
      var newBuffer = new ArrayBuffer(newSize)
      var copyView = new Int8Array(newBuffer)
      copyView.set(this.mem)
      this.size = newSize
    }
    
    this.defineSelf(key)
    this.set(key, val)
  },
  defineSelf: function(key) {
     Object.defineProperty(this._self, key, {
      get: function() {
        return this._Zed.get(key) //this._Zed.dataView.getInt32(this._Zed.map[key] >>> 3)
      },
      set: function(val) {
        return this._Zed.set(key, val) //this._Zed.dataView.setInt32(this._Zed.map[key] >>> 3, val)
      }
    })
  },
  get: function(key) {
    var index = this.map[key] >>> 3
    var type = this.typeMapInverse[this.map[key] & 7]
    if (type === 'integer') {
      return this.dataView.getInt32(index)
    }
    if (type === 'float') {
      return this.dataView.getFloat64(index)
    }
    if (type === 'string') {
      // TODO: perhaps use ranges
      var length = this.dataView.getInt16(index)
      var str = ''
      for(var i=0;i<length;i++) {
        str += String.fromCharCode(this.dataView.getUint8(index + i + 2))
      }
      return str
    }
    if (type ==='array') {
      var length = this.dataView.getInt32(index) >> 3
      var innerType = this.typeMapInverse[this.dataView.getInt32(index) & 7]
      if( innerType === 'integer') {
        return new Int32Array(this.mem, index+4, length)
      }
      if( innerType === 'float') {
        return new Float64Array(this.mem, index+4, length)
      }
    }
  },
  set: function(key, val) {
    var index = this.map[key] >>> 3
    var type = this.typeMapInverse[this.map[key] & 7]
    if(type === 'integer') {
      return this.dataView.setInt32(index, val)
    }
    if (type === 'float') {
      return this.dataView.setFloat64(index, val)
    }
    if(type === 'string') {
      // TODO: perhaps use ranges
      var length = this.dataView.getInt16(index) || val.length
      
      // if lengths differ, create a new string instead of modifying old one
      // TODO: garbage collection
      if(val.length !== length) {
        this.add(key, val, 'string')
        return this.get(key)
      }
      this.dataView.setInt16(index, length)
      for(var i=0; i < length;i++){
        this.dataView.setUint8(index + i + 2, val.charCodeAt(i))
      }
      return 
    }
    if(type === 'array') {
      var length = this.dataView.getInt32(index) >>> 3 || val.length
      var innerType = this.dataView.getInt32(index) & 7 && this.typeMapInverse[this.dataView.getInt32(index) & 7] || this.typeOf(val[0])
      this.dataView.setInt32(index, this.encodeArrKey(length, innerType))
      for(var i=0; i < length;i++){
        if( innerType === 'integer') {
          this.dataView.setInt32(index + i*4 + 4, val[i], true)
        }
        if( innerType === 'float') {
          this.dataView.setFloat64(index + i*8 + 4, val[i], true)
        }
      }
      
    }
  },
  nextPowerOf: function(val, exponent) {
    exponent = exponent || 2
    return Math.pow(2, Math.ceil(Math.log(val) / Math.log(exponent)))
  },
  // returns size of object in bytes (8 bits)
  sizeMap: {
    'integer': 4,
    'float': 8,
    'boolean': 1,
    'null': 0,
    'undefined': 0,
  },
  sizeOf: function(obj) {
    var type = this.typeOf(obj)
    
    if(typeof this.sizeMap[type] !== 'undefined') return this.sizeMap[type]
    
    if (type === 'array') {
      var self = this
      // inner size plus 32bit length/type identifier
      return obj.reduce(function(sum, val) {
        return sum + self.sizeOf(val)
      }, 0) + 4
    }
    
    if (type === 'string') {
      // 8bit chars, plus 16bit length identifier
      return obj.length + 2
    }
    
    if (obj instanceof Zed) {
      return obj._Zed.size
    }
    
    if (type === 'object') {
      var self = this
      return Object.keys(obj).reduce(function(sum, key) {
        return sum + self.sizeOf(obj[key])
      }, 0)
    }
    
    console.error('ERROR READING SIZE OF OBJECT')
    return -1
  }
}



// ideas
// use DataView for reads
// cache views per obj: Int8View(buffer, start, len)
// only use maps for initialization / storing state
//   and simply rely on defineProp inside closure

// usage
var z = new Zed({
  num: 1,
  float: 2.3,
  string: 'abc',
  arrInt: [1, 2, 3],
  arrFloat: [1.2, 1.3, 1.4],
  /*arrString: ['a','b','c','d'],
  arrObj: [{
    key: 'val'
  }, {
    key2: 2.2
  }, {
    key3: 3
  }],
  func: function() {
    console.log('func')
  },
  obj: {
    num: 1,
    float: 2.3,
    string: 'abc',
    arrInt: [1, 2, 3],
    arrFloat: [1.2, 1.3, 1.4],
    arrString: ['a','b','c','d'],
    arrObj: [{
      key: 'val'
    }, {
      key2: 2.2
    }, {
      key3: 3
    }]
    typedArray: new ArrayBuffer(100),
    func: function() {
      console.log('func')
    }
  }*/
})
console.log(z.num)
z.num+=1
console.log(z.num)
z.num = 10
console.log(z.num)
console.log(z.float)
z.float += 1.1
console.log(z.float)
z.float = 0.1
console.log(z.float)
console.log(z.string)
console.log(Array.apply([], z.arrInt))
z.arrInt[0] += 100
console.log(Array.apply([], z.arrInt))
console.log(Array.apply([], z.arrFloat))
z.arrFloat[0] += 100
console.log(Array.apply([], z.arrFloat))
/*console.log(z.arrString)
z.arrInt.append(12)
z.arrFloat[0]+=1.1
z.arrString[0] = 'abc'
z.arrObj.toString()
z.func()
z.obj.arrObj.toString()*/
