(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.VueReactivity = {}));
}(this, (function (exports) { 'use strict';

    function computed() {
    }

    var isObject = function (val) { return typeof val == 'object' && val !== null; };
    var isSymbol = function (val) { return typeof val == 'symbol'; };
    var isArray = Array.isArray;
    var isInteger = function (key) { return '' + parseInt(key, 10) === key; };
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var hasOwn = function (val, key) { return hasOwnProperty.call(val, key); };
    var hasChanged = function (value, oldValue) { return value !== oldValue; };

    function effect(fn, options) {
        if (options === void 0) { options = {}; }
        var effect = createReactiveEffect(fn, options);
        if (!options.lazy) {
            effect();
        }
        return effect;
    }
    var activeEffect; // 用来存储当前的effect函数
    var uid = 0;
    var effectStack = [];
    function createReactiveEffect(fn, options) {
        var effect = function () {
            if (!effectStack.includes(effect)) { // 防止递归执行
                try {
                    activeEffect = effect;
                    effectStack.push(activeEffect);
                    return fn(); // 用户自己写的逻辑, 内部会对数据进行取值操作 ,在取值时 可以拿到这个activeAffect
                }
                finally {
                    effectStack.pop();
                    activeEffect = effectStack[effectStack.length - 1];
                }
            }
        };
        effect.id = uid++;
        effect.deps = []; // 用来表示 effect中依赖了那属性
        effect.options = options;
        return effect;
    }
    // {object:{key:[effect,effect]}}
    var targetMap = new WeakMap(); // {target:{key:new Set()}}
    // 将属性和effect做一个关联
    function track(target, key) {
        if (activeEffect == undefined) {
            return;
        }
        var depsMap = targetMap.get(target);
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        var dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = new Set));
        }
        if (!dep.has(activeEffect)) { // 如果没有effect 就把effect放进到集合中
            dep.add(activeEffect);
            activeEffect.deps.push(dep); // 双向记忆的过程
        }
    }
    // trigger属性
    function trigger(target, type, key, value, oldValue) {
        var depsMap = targetMap.get(target);
        if (!depsMap) {
            return;
        }
        var run = function (effects) {
            if (effects)
                effects.forEach(function (effect) { return effect(); });
        };
        // 数组有特殊的情况
        if (key === 'length' && isArray(target)) {
            depsMap.forEach(function (dep, key) {
                if (key == 'length' || key >= value) { // 如果改的长度 小于数组原有的长度时 应该更新视图
                    run(dep);
                }
            });
        }
        else {
            // 对象的处理
            if (key != void 0) { // 说明修改了key
                run(depsMap.get(key));
            }
            switch (type) {
                case 'add':
                    if (isArray(target)) { // 给数组如果通过索引增加选项
                        if (isInteger(key)) {
                            run(depsMap.get('length')); // 因为如果页面中直接使用了数组也会对数组进行取值操作，会对length 进行收集，新增属性时直接触发length即可
                        }
                    }
                    break;
            }
        }
    }

    function createGetter() {
        return function get(target, key, receiver) {
            var res = Reflect.get(target, key, receiver); // target[key];
            // 如果取的值是symbol 类型 我要忽略他
            if (isSymbol(key)) { // 数组中有很多symbol的内置方法 
                return res;
            }
            // 依赖收集
            console.log(key);
            track(target, key);
            console.log('此时数据做了获取的操作'); // todo...
            if (isObject(res)) { // 取值是对象在进行代理 懒递归
                return reactive(res);
            }
            return res;
        };
    }
    function createSetter() {
        return function set(target, key, value, receiver) {
            // vue2不支持新增属性
            // 新增还是修改?
            var oldValue = target[key]; // 如果是修改那肯定有老值
            // 看一下有没有这个属性 
            // 第一种是 数组新增的逻辑  第二种是对象的逻辑
            var hadKey = isArray(target) && isInteger(key) ? Number(key) < target.length : hasOwn(target, key);
            var result = Reflect.set(target, key, value, receiver); //  target[key] = value;
            // 新增属性是对象无所谓 ，只有取的时候才会做代理
            if (!hadKey) {
                trigger(target, 'add', key, value);
            }
            else if (hasChanged(value, oldValue)) {
                trigger(target, 'set', key, value);
            }
            return result;
        };
    }
    var get = createGetter(); // 为了预置参数
    var set = createSetter();
    var mutableHandlers = {
        get: get,
        set: set
    };

    function reactive(target) {
        // 我们需要将目标变成响应式对象，Proxy
        return createReactiveObject(target, mutableHandlers); // 核心的操作就是当读取文件时做依赖收集，当数据变化时要重新执行effect
    }
    var proxyMap = new WeakMap();
    function createReactiveObject(target, baseHandlers) {
        // 如果不是对象直接不理你
        if (!isObject(target)) {
            return target;
        }
        var exisitingProxy = proxyMap.get(target);
        if (exisitingProxy) {
            return exisitingProxy;
        }
        // 只是对最外层对象做代理 ，默认不会递归，而且不会重新重写对象中的属性
        var proxy = new Proxy(target, baseHandlers);
        proxyMap.set(target, proxy); // 将代理的对象和 代理后的结果做一个映射表
        return proxy;
    }

    function ref() {
    }

    exports.computed = computed;
    exports.effect = effect;
    exports.reactive = reactive;
    exports.ref = ref;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=vue.js.map
