const Signal = require("../signal");
const { MemberValue } = require("../value");

//节点处理
const NodeHandler = {
  // 一开始把AST树放进NodeIterator肯定会遇到Program
  Program(nodeIterator) {
    for (const node of nodeIterator.node.body) {
      //把body里面所有的节点都让一开始传入AST的遍历器遍历一遍节点
      nodeIterator.traverse(node);
    }
  },

  // 处理变量声明节点
  VariableDeclaration(nodeIterator) {
    const kind = nodeIterator.node.kind;
    for (const declaration of nodeIterator.node.declarations) {
      const { name } = declaration.id;
      const value = declaration.init
        ? nodeIterator.traverse(declaration.init)
        : undefined;
      // 在作用域当中定义变量
      // 若为块级作用域且关键字为var，则需要放在父作用域
      if (nodeIterator.scope.type === "block" && kind === "var") {
        nodeIterator.scope.parentScope.declare(name, value, kind);
      } else {
        nodeIterator.scope.declare(name, value, kind);
      }
    }
  },

  // 标识符节点处理器，从作用域中获取标识符的值
  Identifier(nodeIterator) {
    if (nodeIterator.node.name === "undefined") {
      return undefined;
    }
    return nodeIterator.scope.get(nodeIterator.node.name).value;
  },

  // 字符节点处理器，返回字符节点的值
  Literal(nodeIterator) {
    return nodeIterator.node.value;
  },

  // 表达式处理器
  ExpressionStatement(nodeIterator) {
    return nodeIterator.traverse(nodeIterator.node.expression);
  },

  // 表达式调用节点处理器，处理func()
  CallExpression(nodeIterator) {
    // 遍历callee获得函数体
    const func = nodeIterator.traverse(nodeIterator.node.callee);
    // 获取参数，因为参数本质上也是一个结点，所以用map处理
    const args = nodeIterator.node.arguments.map((argument) =>
      nodeIterator.traverse(argument)
    );

    let value;
    if (nodeIterator.node.callee.type === "MemberExpression") {
      value = nodeIterator.traverse(nodeIterator.node.callee.object);
    }
    //返回函数运行的结果
    return func.apply(value, args);
  },

  // 如果在CallExpression中遇到MemberExpression
  MemberExpression(nodeIterator) {
    const obj = nodeIterator.traverse(nodeIterator.node.object);
    const name = nodeIterator.node.property.name;
    return obj[name];
  },

  // 对象节点处理器，key支持常量和变量(Identifier和Literal)
  ObjectExpression(nodeIterator) {
    const obj = {};
    for (const prop of nodeIterator.node.properties) {
      let key;
      if (prop.key.type === "Literal") {
        key = `${prop.key.value}`;
      } else if (prop.key.type === "Identifier") {
        key = prop.key.name;
      } else {
        throw new Error(
          `Interpreter: [ObjectExpression] Unsupported property key type "${prop.key.type}"`
        );
      }
      // value只支持Literal
      obj[key] = nodeIterator.traverse(prop.value);
    }
    return obj;
  },

  // 数组节点处理器，支持Literal
  ArrayExpression(nodeIterator) {
    return nodeIterator.node.elements.map((element) =>
      nodeIterator.traverse(element)
    );
  },

  // 块级作用域处理器，用于处理块级声明节点，如函数、循环、try...catch...
  BlockStatement(nodeIterator) {
    // 先创建一个块级作用域
    let scope = nodeIterator.createScope("block");

    // 处理块级节点内的每一个节点
    for (const node of nodeIterator.node.body) {
      // 如果是函数作用域
      if (node.type === "FunctionDeclaration") {
        nodeIterator.traverse(node, { scope });
        // 如果在块级作用域里出现var
      } else if (node.type === "VariableDeclaration" && node.kind === "var") {
        // 有可能是var a = 1,b = 2; 因此需要遍历
        // 有可能是var a; 因此需要 if(declaration.init) 如果不初始化的就是null
        for (const declaration of node.declarations) {
          if (declaration.init) {
            scope.declare(
              declaration.id.name,
              nodeIterator.traverse(declaration.init, { scope }),
              node.kind
            );
          } else {
            scope.declare(declaration.id.name, undefined, node.kind);
          }
        }
      }
    }

    // 提取关键字（return, break, continue）
    for (const node of nodeIterator.node.body) {
      if (node.type === "FunctionDeclaration") {
        continue;
      }
      const signal = nodeIterator.traverse(node, { scope });
      // 用来判断是不是 return break continue
      if (Signal.isSignal(signal)) {
        return signal;
      }
    }
  },
  // Return
  ReturnStatement(nodeIterator) {
    let value;
    if (nodeIterator.node.argument) {
      value = nodeIterator.traverse(nodeIterator.node.argument);
    }
    return Signal.Return(value);
  },
  // Break
  BreakStatement(nodeIterator) {
    let label;
    if (nodeIterator.node.label) {
      label = nodeIterator.node.label.name;
    }
    return Signal.Break(label);
  },
  // Continue
  ContinueStatement(nodeIterator) {
    let label;
    if (nodeIterator.node.label) {
      label = nodeIterator.node.label.name;
    }
    return Signal.Continue(label);
  },

  // If
  IfStatement(nodeIterator) {
    if (nodeIterator.traverse(nodeIterator.node.test)) {
      return nodeIterator.traverse(nodeIterator.node.consequent);
    } else if (nodeIterator.node.alternate) {
      return nodeIterator.traverse(nodeIterator.node.alternate);
    }
  },
  // Switch
  SwitchStatement(nodeIterator) {
    const discriminant = nodeIterator.traverse(nodeIterator.node.discriminant);
    for (const theCase of nodeIterator.node.cases) {
      if (
        !theCase.test ||
        discriminant === nodeIterator.traverse(theCase.test)
      ) {
        const signal = nodeIterator.traverse(theCase);
        if (Signal.isBreak(signal)) {
          break;
        } else if (Signal.isContinue(signal)) {
          continue;
        } else if (Signal.isReturn(signal)) {
          return signal;
        }
      }
    }
  },
  // For
  ForStatement(nodeIterator) {
    const node = nodeIterator.node;
    let scope = nodeIterator.scope;
    // 如果循环变量不是var则需要创建一个块级作用域
    if (
      node.init &&
      node.init.type === "VariableDeclaration" &&
      node.init.kind !== "var"
    ) {
      scope = nodeIterator.createScope("block");
    }
    // 根据AST树来模仿for循环
    for (
      node.init && nodeIterator.traverse(node.init, { scope });
      node.test ? nodeIterator.traverse(node.test, { scope }) : true;
      node.update && nodeIterator.traverse(node.update, { scope })
    ) {
      const signal = nodeIterator.traverse(node.body, { scope });
      if (Signal.isBreak(signal)) {
        break;
      } else if (Signal.isContinue(signal)) {
        continue;
      } else if (Signal.isReturn(signal)) {
        return signal;
      }
    }
  },

  // for/in语句节点，left和right属性分别表示在in关键词左右的语句
  ForInStatement(nodeIterator) {
    const { left, right, body } = nodeIterator.node;
    let scope = nodeIterator.scope;
    let value;
    if (left.type === "VariableDeclaration") {
      const id = left.declarations[0].id;
      value = scope.declare(id.name, undefined, left.kind);
    } else if (left.type === "Identifier") {
      value = scope.get(left.name, true);
    } else {
      throw new Error(
        `Interpreter: [ForInStatement] Unsupported left type "${left.type}"`
      );
    }
    for (const key in nodeIterator.traverse(right)) {
      value.value = key;
      const signal = nodeIterator.traverse(body, { scope });
      if (Signal.isBreak(signal)) {
        break;
      } else if (Signal.isContinue(signal)) {
        continue;
      } else if (Signal.isReturn(signal)) {
        return signal;
      }
    }
  },

  // while
  WhileStatement(nodeIterator) {
    while (nodeIterator.traverse(nodeIterator.node.test)) {
      const signal = nodeIterator.traverse(nodeIterator.node.body);

      if (Signal.isBreak(signal)) {
        break;
      } else if (Signal.isContinue(signal)) {
        continue;
      } else if (Signal.isReturn(signal)) {
        return signal;
      }
    }
  },

  // do{}while()
  DoWhileStatement(nodeIterator) {
    do {
      const signal = nodeIterator.traverse(nodeIterator.node.body);

      if (Signal.isBreak(signal)) {
        break;
      } else if (Signal.isContinue(signal)) {
        continue;
      } else if (Signal.isReturn(signal)) {
        return signal;
      }
    } while (nodeIterator.traverse(nodeIterator.node.test));
  },

  // switch
  SwitchCase(nodeIterator) {
    for (const node of nodeIterator.node.consequent) {
      const signal = nodeIterator.traverse(node);
      if (Signal.isSignal(signal)) {
        return signal;
      }
    }
  },

  // 函数定义节点处理器
  FunctionDeclaration(nodeIterator) {
    const fn = NodeHandler.FunctionExpression(nodeIterator);
    nodeIterator.scope.varDeclare(nodeIterator.node.id.name, fn);
    return fn;
  },

  // 函数表达式节点处理器
  FunctionExpression(nodeIterator) {
    const node = nodeIterator.node;
    /**
     * 1、定义函数需要先为其定义一个函数作用域，且允许继承父级作用域
     * 2、注册`this`, `arguments`和形参到作用域的变量空间
     * 3、检查return关键字
     * 4、定义函数名和长度
     */
    const fn = function () {
      // 创建函数作用域
      const scope = nodeIterator.createScope("function");
      scope.constDeclare("this", this);
      scope.constDeclare("arguments", arguments);
      // 处理params(值得一提的是forEach的回调里可以放三个参数 item index array)
      node.params.forEach((param, index) => {
        const name = param.name;
        scope.varDeclare(name, arguments[index]);
      });
      // 先会处理BlockStatement，然后一层层处理下去，检查有没有return
      const signal = nodeIterator.traverse(node.body, { scope });
      // 如果有return就返回这个值
      if (Signal.isReturn(signal)) {
        return signal.value;
      }
    };
    // 定义函数的名字和长度
    Object.defineProperties(fn, {
      name: { value: node.id ? node.id.name : "" },
      length: { value: node.params.length },
    });
    return fn;
  },

  // 处理this
  ThisExpression(nodeIterator) {
    const value = nodeIterator.scope.get("this");
    return value ? value.value : null;
  },

  // 处理new
  NewExpression(nodeIterator) {
    const func = nodeIterator.traverse(nodeIterator.node.callee);
    const args = nodeIterator.node.arguments.map((arg) =>
      nodeIterator.traverse(arg)
    );
    // 在new一个构造函数的同时会执行这个构造函数
    return new (func.bind(null, ...args))();
  },

  // 更新变量(只有自增和自减)
  UpdateExpression(nodeIterator) {
    // prefix是 ++a 和 a++的区别
    const { operator, prefix } = nodeIterator.node;
    const { name } = nodeIterator.node.argument;
    let val = nodeIterator.scope.get(name).value;
    operator === "++"
      ? nodeIterator.scope.set(name, val + 1)
      : nodeIterator.scope.set(name, val - 1);
    if (operator === "++" && prefix) {
      return ++val;
    } else if (operator === "++" && !prefix) {
      return val++;
    } else if (operator === "--" && prefix) {
      return --val;
    } else {
      return val--;
    }
  },

  // 处理赋值运算符写的map对象
  AssignmentExpressionOperatortraverseMap: {
    "=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] = v)
        : // : (value.value = v),
          value.set(v),
    "+=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] += v)
        : // : (value.value += v),
          value.set((value.value += v)),
    "-=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] -= v)
        : value.set((value.value -= v)),
    "*=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] *= v)
        : value.set((value.value *= v)),
    "/=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] /= v)
        : value.set((value.value /= v)),
    "%=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] %= v)
        : value.set((value.value %= v)),
    "**=": () => {
      throw new Error("Interpreter: es5 doen't supports operator \"**=");
    },
    "<<=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] <<= v)
        : value.set((value.value <<= v)),
    ">>=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] >>= v)
        : value.set((value.value >>= v)),
    ">>>=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] >>>= v)
        : value.set((value.value >>>= v)),
    "|=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] |= v)
        : value.set((value.value |= v)),
    "^=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] ^= v)
        : value.set((value.value ^= v)),
    "&=": (value, v) =>
      value instanceof MemberValue
        ? (value.obj[value.prop] &= v)
        : value.set((value.value &= v)),
  },
	
  // 处理赋值运算符
  AssignmentExpression(nodeIterator) {
    const node = nodeIterator.node;
    const value = getIdentifierOrMemberExpressionValue(node.left, nodeIterator);
    return NodeHandler.AssignmentExpressionOperatortraverseMap[node.operator](
      value,
      nodeIterator.traverse(node.right)
    );
  },

  UnaryExpressionOperatortraverseMap: {
    "-": (nodeIterator) => -nodeIterator.traverse(nodeIterator.node.argument),
    "+": (nodeIterator) => +nodeIterator.traverse(nodeIterator.node.argument),
    "!": (nodeIterator) => !nodeIterator.traverse(nodeIterator.node.argument),
    "~": (nodeIterator) => ~nodeIterator.traverse(nodeIterator.node.argument),
    typeof: (nodeIterator) => {
      if (nodeIterator.node.argument.type === "Identifier") {
        try {
          const value = nodeIterator.scope.get(nodeIterator.node.argument.name);
          return value ? typeof value.value : "undefined";
        } catch (err) {
          if (
            err.message === `${nodeIterator.node.argument.name} is not defined`
          ) {
            return "undefined";
          } else {
            throw err;
          }
        }
      } else {
        return typeof nodeIterator.traverse(nodeIterator.node.argument);
      }
    },
    void: (nodeIterator) =>
      void nodeIterator.traverse(nodeIterator.node.argument),
    delete: (nodeIterator) => {
      const argument = nodeIterator.node.argument;
      if (argument.type === "MemberExpression") {
        const obj = nodeIterator.traverse(argument.object);
        const name = getPropertyName(argument, nodeIterator);
        return delete obj[name];
      } else if (argument.type === "Identifier") {
        return false;
      } else if (argument.type === "Literal") {
        return true;
      }
    },
  },
  // 一元运算表达式节点
  UnaryExpression(nodeIterator) {
    return NodeHandler.UnaryExpressionOperatortraverseMap[
      nodeIterator.node.operator
    ](nodeIterator);
  },

  BinaryExpressionOperatortraverseMap: {
    "==": (a, b) => a == b,
    "!=": (a, b) => a != b,
    "===": (a, b) => a === b,
    "!==": (a, b) => a !== b,
    "<": (a, b) => a < b,
    "<=": (a, b) => a <= b,
    ">": (a, b) => a > b,
    ">=": (a, b) => a >= b,
    "<<": (a, b) => a << b,
    ">>": (a, b) => a >> b,
    ">>>": (a, b) => a >>> b,
    "+": (a, b) => a + b,
    "-": (a, b) => a - b,
    "*": (a, b) => a * b,
    "/": (a, b) => a / b,
    "%": (a, b) => a % b,
    "**": (a, b) => {
      throw new Error('Interpreter: es5 doesn\'t supports operator "**"');
    },
    "|": (a, b) => a | b,
    "^": (a, b) => a ^ b,
    "&": (a, b) => a & b,
    in: (a, b) => a in b,
    instanceof: (a, b) => a instanceof b,
  },

  // 二元运算表达式节点
  BinaryExpression(nodeIterator) {
    const a = nodeIterator.traverse(nodeIterator.node.left);
    const b = nodeIterator.traverse(nodeIterator.node.right);
    return NodeHandler.BinaryExpressionOperatortraverseMap[
      nodeIterator.node.operator
    ](a, b);
  },


  LogicalExpressionOperatortraverseMap: {
    "||": (a, b) => a || b,
    "&&": (a, b) => a && b,
  },

	// 逻辑运算表达式节点
  LogicalExpression(nodeIterator) {
    const a = nodeIterator.traverse(nodeIterator.node.left);
    if (a) {
      if (nodeIterator.node.operator == "||") {
        return true;
      }
    } else if (nodeIterator.node.operator == "&&") {
      return false;
    }

    const b = nodeIterator.traverse(nodeIterator.node.right);
    return NodeHandler.LogicalExpressionOperatortraverseMap[
      nodeIterator.node.operator
    ](a, b);
  },

	// 三元运算表达式(条件表达式)
  ConditionalExpression(nodeIterator) {
    return nodeIterator.traverse(nodeIterator.node.test)
      ? nodeIterator.traverse(nodeIterator.node.consequent)
      : nodeIterator.traverse(nodeIterator.node.alternate);
  },

	// throw
  ThrowStatement(nodeIterator) {
    throw nodeIterator.traverse(nodeIterator.node.argument);
  },

	// try{}catch(err){}finally{}
  TryStatement(nodeIterator) {
    const { block, handler, finalizer } = nodeIterator.node;
    try {
      return nodeIterator.traverse(block);
    } catch (err) {
      if (handler) {
        const param = handler.param;
        const scope = nodeIterator.createScope("block");
        scope.letDeclare(param.name, err);
        return nodeIterator.traverse(handler, { scope });
      }
      throw err;
    } finally {
      if (finalizer) {
        return nodeIterator.traverse(finalizer);
      }
    }
  },
  CatchClause(nodeIterator) {
    return nodeIterator.traverse(nodeIterator.node.body);
  },
};

// 工具函数
function getPropertyName(node, nodeIterator) {
  if (node.computed) {
    return nodeIterator.traverse(node.property);
  } else {
    return node.property.name;
  }
}

// 工具函数判断是Identifier还是MemberExpression
function getIdentifierOrMemberExpressionValue(node, nodeIterator) {
  if (node.type === "Identifier") {
    return nodeIterator.scope.get(node.name);
  } else if (node.type === "MemberExpression") {
    const obj = nodeIterator.traverse(node.object);
    const name = getPropertyName(node, nodeIterator);
    return new MemberValue(obj, name);
  } else {
    throw new Error(
      `Interpreter: Not support to get value of node type "${node.type}"`
    );
  }
}

module.exports = NodeHandler;
