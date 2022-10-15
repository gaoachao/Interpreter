const standardMap = require('./standard')
const { SimpleValue } = require('./value')

//作用域
class Scope {
  constructor (type, parentScope) {
		//当前作用域的类型
    this.type = type;
		//父作用域
    this.parentScope = parentScope;
		// 每个作用域都能访问到全局作用域，且预定义变量即全局变量会存放在standardMap
    this.globalDeclaration = standardMap;
		// 每次都新建一个全新的作用域
    this.declaration = Object.create(null);
  }

	// 给全局作用域添加全局变量
  addDeclaration (name, value) {
    this.globalDeclaration[name] = new SimpleValue(value);
  }

	// get得到某个变量的值
	// 优先当前作用域，父作用域次之，全局作用域最后
  get (name) {
    if (this.declaration[name]) {
      return this.declaration[name];
    } else if (this.parentScope) {
      return this.parentScope.get(name);
    } else if (this.globalDeclaration[name]) {
      return this.globalDeclaration[name];
    }
    throw new ReferenceError(`${name} is not defined`);
  }

  set (name, value) {
    if (this.declaration[name] ) {
      this.declaration[name].set(value);
    } else if (this.parentScope) {
      this.parentScope.set(name, value)
    } else if (this.globalDeclaration[name]) {
      return this.globalDeclaration.set(name, value)
    } else {
      throw new ReferenceError(`${name} is not defined`)
    }
  }

  declare (name, value, kind = 'var') {
    if (kind === 'var') {
      return this.varDeclare(name, value)
    } else if (kind === 'let') {
      return this.letDeclare(name, value)
    } else if (kind === 'const') {
      return this.constDeclare(name, value)
    } else {
      throw new Error(`interpreter: Invalid Variable Declaration Kind of "${kind}"`)
    }
  }

  varDeclare (name, value) {
    let scope = this;
    // 若当前作用域存在非函数类型的父级作用域时，就把变量定义到父级作用域
    while (scope.parentScope && scope.type !== 'function') {
      scope = scope.parentScope
    }
    scope.declaration[name] = new SimpleValue(value, 'var')
    return scope.declaration[name]
  }

  letDeclare (name, value) {
    // 不允许重复定义
    if (this.declaration[name]) {
      throw new SyntaxError(`Identifier ${name} has already been declared`);
    }
    this.declaration[name] = new SimpleValue(value, 'let');
    return this.declaration[name];
  }

  constDeclare (name, value) {
    // 不允许重复定义
    if (this.declaration[name]) {
      throw new SyntaxError(`Identifier ${name} has already been declared`);
    }
    this.declaration[name] = new SimpleValue(value, 'const');
    return this.declaration[name];
  }
}

module.exports = Scope;