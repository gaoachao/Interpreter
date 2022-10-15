const nodeHandler = require("./versions");
const Scope = require("./scope");

// 节点遍历器
class NodeIterator {
  constructor(node, scope) {
    this.node = node;
    this.scope = scope;
    this.nodeHandler = nodeHandler;
  }
  // 遍历方法
  traverse(node, options = {}) {
    const scope = options.scope || this.scope;
    // 一开始把AST放进NodeIterator中，会遇到"Program"
    const nodeIterator = new NodeIterator(node, scope);
    // 根据节点类型找到节点处理器当中对应的函数
    const _eval = this.nodeHandler[node.type];
    // 如果找不到就报错
    if (!_eval) {
      throw new Error(`Interpreter: Unknown node type "${node.type}".`);
    }
    // 运行处理函数
    return _eval(nodeIterator);
  }

  // 创建一个作用域
  createScope(blockType = "block") {
    return new Scope(blockType, this.scope);
  }
}

module.exports = NodeIterator;
