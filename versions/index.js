const es5 = require('./es5')

// es5是一个对象，ES5以上的版本会兼容ES5的所有特性，因此用拓展运算符的写法更好，下次就...es6
module.exports =  {
  ...es5
}