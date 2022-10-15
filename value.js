//数据类型
class SimpleValue {
  constructor(value, kind = "") {
    this.value = value;
    this.kind = kind;
  }

  set(value) {
    // 禁止重新对const类型变量赋值
    if (this.kind === "const") {
      throw new TypeError("Assignment to constant variable");
    } else {
      this.value = value;
    }
  }

  get() {
    return this.value;
  }
}

// 引用对象成员 object是引用对象的表达式节点
class MemberValue {
  constructor(obj, prop) {
    this.obj = obj;
    this.prop = prop;
  }

  set(value) {
    this.obj[this.prop] = value;
  }

  get() {
    return this.obj[this.prop];
  }
}

// module.exports.SimpleValue = SimpleValue;
// module.exports.MemberValue = MemberValue;

module.exports = {
  SimpleValue,
  MemberValue,
};
