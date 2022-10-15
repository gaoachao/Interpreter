const { Parser } = require("acorn");
const NodeIterator = require("./iterator");
const Scope = require("./scope");

class Interpreter {
  constructor(code = "", preDeclaration = {}) {
    this.code = code;
		//preDeclaration 是预先定义的变量
    this.preDeclaration = preDeclaration;
    this.ast = Parser.parse(code);
    this.nodeIterator = null;
    this.init();
  }

	//init方法来预先定义变量
  init() {
    const globalScope = new Scope("function");
		//遍历传入的对象
    Object.keys(this.preDeclaration).forEach((key) => {
      globalScope.addDeclaration(key, this.preDeclaration[key]);
    });
		//把全局作用域和null节点传入节点遍历器
    this.nodeIterator = new NodeIterator(null, globalScope);
  }

  run() {
    return this.nodeIterator.traverse(this.ast);
  }
}

module.exports = Interpreter;

new Interpreter(`
	const a = 2;
	console.log(a);
`,{
	b:2
}).run();

