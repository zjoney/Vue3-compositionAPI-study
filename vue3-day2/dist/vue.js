(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Vue = {}));
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
    var isString = function (value) { return typeof value == 'string'; };
    var isFunction = function (value) { return typeof value == 'function'; };

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

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function createVnode(type, props, children) {
        if (props === void 0) { props = {}; }
        if (children === void 0) { children = null; }
        // type 是什么类型？
        var shapeFlag = isString(type) ?
            1 /* ELEMENT */ :
            isObject(type) ?
                4 /* STATEFUL_COMPONENT */ : 0;
        var vnode = {
            type: type,
            props: props,
            children: children,
            component: null,
            el: null,
            key: props.key,
            shapeFlag: shapeFlag // vue3 里面非常优秀的做法  虚拟节点的类型  元素 、 组件
        };
        if (isArray(children)) {
            // 1  16
            // 00000001
            // 00001000  
            // 00001001
            vnode.shapeFlag |= 16 /* ARRAY_CHILDREN */; // 如果在或的过程中有一个是1就是1 把两个数相加
        }
        else {
            // 1  8 = 9
            // 4 || 16
            // 00000100
            // 00001000 // 1100
            vnode.shapeFlag |= 8 /* TEXT_CHILDREN */;
        }
        return vnode;
    }

    function createAppAPI(render) {
        return function (rootComponent) {
            var app = {
                mount: function (container) {
                    // 用户调用的mount方法 
                    var vnode = createVnode(rootComponent);
                    render(vnode, container);
                }
            };
            return app;
        };
    }

    function createComponentInstace(vnode) {
        var instance = {
            type: vnode.type,
            props: {},
            vnode: vnode,
            render: null,
            setupState: null,
            isMounted: false,
        };
        return instance;
    }
    var setupComponent = function (instance) {
        // 1）源码中会对属性进行初始化
        // 2) 会对插槽进行初始化
        // 3).调用setup方法
        setupStatefulComponent(instance);
    };
    function setupStatefulComponent(instance) {
        var Component = instance.type; // 组件的虚拟节点
        var setup = Component.setup;
        if (setup) {
            var setUpResult = setup(); // 获取setup返回的值
            // 判断返回值类型
            handleSetupResult(instance, setUpResult);
        }
    }
    function handleSetupResult(instance, setUpResult) {
        if (isFunction(setUpResult)) {
            instance.render = setUpResult; // 获取render方法
        }
        else {
            instance.setupState = setUpResult;
        }
        finishComponentSetup(instance);
    }
    function finishComponentSetup(instance) {
        var Component = instance.type;
        if (Component.render) {
            instance.render = Component.render; // 默认redner的优先级高于setup返回的render
        }
        else if (!instance.render) ;
        // vue3 是兼容vue2的属性的 data component watch
        // applyOptions() vue2 和 vue3 中的setup返回的结果做合并操作
    }

    function createRenderer(options) {
        return baseCreateRenderer(options);
    }
    // vue2 compile模块
    function baseCreateRenderer(options) {
        var hostCreateElement = options.createElement, hostPatchProp = options.patchProp, hostSetElementText = options.setElementText, hostInsert = options.insert, hostRemove = options.remove;
        var mountElement = function (vnode, container) {
            // n2 虚拟节点   container就是容器
            var shapeFlag = vnode.shapeFlag, props = vnode.props;
            var el = vnode.el = hostCreateElement(vnode.type);
            // 创建儿子节点
            if (shapeFlag & 8 /* TEXT_CHILDREN */) {
                hostSetElementText(el, vnode.children);
            }
            else if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                mountChildren(vnode.children, el);
            }
            if (props) {
                for (var key in props) {
                    hostPatchProp(el, key, null, props[key]);
                }
            }
            hostInsert(el, container);
        };
        var mountChildren = function (children, container) {
            for (var i = 0; i < children.length; i++) {
                patch(null, children[i], container);
            }
        };
        var mountComponent = function (initialVnode, container) {
            // 组件挂载逻辑  1.创建组件的实例 2.找到组件的render方法 3.执行render
            // 组件实例要记录当前组件的状态
            var instance = initialVnode.component = createComponentInstace(initialVnode);
            setupComponent(instance); // 找到组件的setup方法
            // 调用render方法， 如果render方法中数据变化了 会重新渲染
            setupRenderEffect(instance, initialVnode, container); // 给组件创建一个effect 用于渲染 == vue2 watcher
        };
        var setupRenderEffect = function (instance, initialVnode, container) {
            effect(function componentEffect() {
                if (!instance.isMounted) {
                    // 渲染组件中的内容
                    var subTree = instance.subTree = instance.render(); // 组件对应渲染的结果
                    patch(null, subTree, container);
                    instance.isMounted = true;
                }
                else {
                    // 更新逻辑
                    var prev = instance.subTree; // 上一次的渲染结果
                    var next = instance.render();
                    console.log(prev, next);
                }
            });
        };
        var processElement = function (n1, n2, container) {
            if (n1 == null) {
                mountElement(n2, container);
            }
        };
        var processComponent = function (n1, n2, container) {
            if (n1 == null) {
                mountComponent(n2, container);
            }
        };
        var render = function (vnode, container) {
            // 我需要将虚拟节点  变成真实节点 挂载到容器上
            patch(null, vnode, container);
        };
        var patch = function (n1, n2, container) {
            var shapeFlag = n2.shapeFlag;
            // 20  组件孩子里有数组
            // 10000
            // 01000
            if (shapeFlag & 1 /* ELEMENT */) { // 都是1 才是1
                processElement(n1, n2, container);
            }
            else if (shapeFlag & 4 /* STATEFUL_COMPONENT */) {
                processComponent(n1, n2, container);
            }
        };
        return {
            createApp: createAppAPI(render)
        };
    }

    function h(type, props, children) {
        if (props === void 0) { props = {}; }
        if (children === void 0) { children = null; }
        return createVnode(type, props, children);
    }

    var nodeOps = {
        createElement: function (type) {
            return document.createElement(type);
        },
        setElementText: function (el, text) {
            el.textContent = text;
        },
        insert: function (child, parent, anchor) {
            if (anchor === void 0) { anchor = null; }
            parent.insertBefore(child, anchor); // appendChild
        },
        remove: function (child) {
            var parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        }
    };

    function patchClass(el, value) {
        if (value == null) {
            value = '';
        }
        el.className = value;
    }
    function patchStyle(el, prev, next) {
        var style = el.style;
        if (!next) {
            el.removeAttribute('style'); // 说明不需要有样式
        }
        else {
            for (var key in next) {
                style[key] = next[key];
            }
            if (prev) {
                for (var key in prev) {
                    if (next[key] == null) {
                        style[key] = '';
                    }
                }
            }
        }
    }
    function patchAttr(el, key, value) {
        if (value == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, value);
        }
    }
    function patchProp(el, key, prevValue, nextValue) {
        switch (key) {
            case 'class':
                patchClass(el, nextValue);
                break;
            case 'style':
                // {color:'red'}
                patchStyle(el, prevValue, nextValue);
                break;
            default:
                patchAttr(el, key, nextValue);
        }
    }

    var renderOptions = __assign(__assign({}, nodeOps), { patchProp: patchProp }); // dom操作
    function ensureRenderer() {
        return createRenderer(renderOptions);
    }
    //  createApp(App).mount('#app');
    function createApp(rootComponent) {
        // 1.根据组件 创建一个渲染器
        var app = ensureRenderer().createApp(rootComponent);
        var mount = app.mount;
        app.mount = function (container) {
            container = document.querySelector(container);
            // 1.挂载时需要将容器清空 在进行挂载
            container.innerHTML = '';
            mount(container);
        };
        return app;
    }
    // reactive

    exports.computed = computed;
    exports.createApp = createApp;
    exports.createRenderer = createRenderer;
    exports.effect = effect;
    exports.h = h;
    exports.reactive = reactive;
    exports.ref = ref;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=vue.js.map
