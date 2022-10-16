# Interpreter

## 前言

- `interpreter`是一个`JavaScript`解释器，功能是将AST抽象树转换为`JavaScript`高级语言。
- 对应的是`babel`的`generate`阶段。（不过`babel`还能生成`souce-map`）
- 目前只支持ES5(以及ES6`const`和`let`)的语法，且使用语言`JavaScript`，下一步将尝试使用`TypeScript`。

## 编译器工作流程

以`babel`为例，可以分为三个阶段：

- **解析（Parse）** ：将源代码转换成更加抽象的表示方法（例如抽象语法树）。包括词法分析和语法分析。词法分析主要把字符流源代码（Char Stream）转换成令牌流（ Token Stream），语法分析主要是将令牌流转换成抽象语法树（Abstract Syntax Tree，AST）。
- **转换（Transform）** ：通过 Babel 的插件能力，对（抽象语法树）做一些特殊处理，将高版本语法的 AST 转换成支持低版本语法的 AST。让它符合编译器的期望，当然在此过程中也可以对 AST 的 Node 节点进行优化操作，比如添加、更新以及移除节点等。
- **生成（Generate）** ：将 AST 转换成字符串形式的低版本代码，同时也能创建 Source Map 映射。

## JS解释器的工作流程

### 文件目录

- **version**
  - **index.js**：将各个版本的模块导出（考虑到高版本兼容低版本）
  - **es5.js**：包含一个`NodeHandler`对象，处理不同类型的节点
- **index.js**：入口文件，有一个`Interpreter`类，可以传入AST树然后生成JS代码
- **iterator.js**：节点遍历器，有两个方法：`traverse`和`createScope`
- **scope.js**：处理作用域，创建一个`Scope`类
- **signal.js**：判断是否为`return`或`break` 或`continue`
- **standard.js**：标准库，放入全局作用域
- **value.js**：两种变量类型`SimpleValue`和`MemberValue`，后者是对象的属性

### 流程图

![Interpreter](https://github.com/gaoachao/Interpreter/raw/main/assets/images/1.jpg)

## 参考资料

- [由 Babel 理解前端编译原理](https://juejin.cn/post/7080832945136599077)
- [使用 Acorn 来解析 JavaScript](https://juejin.cn/post/6844903450287800327)
- [在线的AST抽象树转换器](https://astexplorer.net/)