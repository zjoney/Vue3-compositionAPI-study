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
        var mountElement = function (vnode, container, anchor) {
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
            hostInsert(el, container, anchor);
        };
        var mountChildren = function (children, container) {
            for (var i = 0; i < children.length; i++) {
                patch(null, children[i], container);
            }
        };
        var patchProps = function (oldProps, newProps, el) {
            if (oldProps !== newProps) {
                // 新的属性 需要覆盖掉老的
                for (var key in newProps) {
                    var prev = oldProps[key];
                    var next = newProps[key];
                    if (prev !== next) {
                        hostPatchProp(el, key, prev, next);
                    }
                }
                // 老的有的属性 新的没有 将老的删除掉
                for (var key in oldProps) {
                    if (!(key in newProps)) {
                        hostPatchProp(el, key, oldProps[key], null);
                    }
                }
            }
        };
        var patchKeydChildren = function (c1, c2, el) {
            // 内部有优化策略 
            // abc    i = 0
            // abde  从头比
            var i = 0;
            var e1 = c1.length - 1; // 老儿子中最后一项的索引
            var e2 = c2.length - 1; // 新儿子中最后一项的索引
            while (i <= e1 && i <= e2) {
                var n1 = c1[i];
                var n2 = c2[i];
                if (isSameVnodeType(n1, n2)) {
                    patch(n1, n2, el); // 会递归比对子元素
                }
                else {
                    break;
                }
                i++;
            }
            // abc // e1 = 2
            //eabc // e2 = 3 // 从后比
            while (i <= e1 && i <= e2) {
                var n1 = c1[e1];
                var n2 = c2[e2];
                if (isSameVnodeType(n1, n2)) {
                    patch(n1, n2, el);
                }
                else {
                    break;
                }
                e1--;
                e2--;
            }
            //  只考虑 元素新增和删除的情况 
            // abc => abcd  (i=3  e1=2  e2=3 )    abc  => dabc (i=0  e1=-1  e2=0 )
            // 只要i 大于了 e1 表示新增属性
            if (i > e1) { // 说明有新增 
                if (i <= e2) { // 表示有新增的部分
                    // 先根据e2 取他的下一个元素  和 数组长度进行比较
                    var nextPos = e2 + 1;
                    var anchor = nextPos < c2.length ? c2[nextPos].el : null;
                    while (i <= e2) {
                        patch(null, c2[i], el, anchor);
                        i++;
                    }
                }
                // abcd  abc (i=3  e1=3  e2=2)
            }
            else if (i > e2) { // 删除
                while (i <= e1) {
                    hostRemove(c1[i].el);
                    i++;
                }
            }
            else {
                // 无规律的情况 diff 算法
                // ab [cde] fg   // s1=2  e1=4  
                // ab [dech] fg  //  s2=2  e2=5;  => [5,4,3,0]; 无视他
                var s1 = i;
                var s2 = i;
                // 新的索引 和 key 做成一个映射表
                var keyToNewIndexMap = new Map();
                for (var i_1 = s2; i_1 <= e2; i_1++) {
                    var nextChild = c2[i_1];
                    keyToNewIndexMap.set(nextChild.key, i_1);
                }
                var toBePatched = e2 - s2 + 1;
                var newIndexToOldMapIndex = new Array(toBePatched).fill(0);
                // 只是做相同属性的diff 但是位置可能还不对
                for (var i_2 = s1; i_2 <= e1; i_2++) {
                    var prevChild = c1[i_2];
                    var newIndex = keyToNewIndexMap.get(prevChild.key); // 获取新的索引
                    if (newIndex == undefined) {
                        hostRemove(prevChild.el); // 老的有 新的没有直接删除
                    }
                    else {
                        newIndexToOldMapIndex[newIndex - s2] = i_2 + 1;
                        patch(prevChild, c2[newIndex], el);
                    }
                }
                //  最长增长序列 [0,1]  [0,1,2,3]
                var increasingIndexSequence = getSequence(newIndexToOldMapIndex);
                var j = increasingIndexSequence.length - 1;
                for (var i_3 = toBePatched - 1; i_3 >= 0; i_3--) {
                    var nextIndex = s2 + i_3; // [edch]   找到h的索引 
                    var nextChild = c2[nextIndex]; // 找到 h
                    var anchor = nextIndex + 1 < c2.length ? c2[nextIndex + 1].el : null; // 找到当前元素的下一个元素
                    if (newIndexToOldMapIndex[i_3] == 0) { // 这是一个新元素 直接创建插入到 当前元素的下一个即可
                        patch(null, nextChild, el, anchor);
                    }
                    else {
                        // 根据参照物 将节点直接移动过去  所有节点都要移动 （但是有些节点可以不动）
                        if (j < 0 || i_3 != increasingIndexSequence[j]) {
                            // 此时没有考虑不动的情况 
                            hostInsert(nextChild.el, el, anchor);
                        }
                        else {
                            j--;
                        }
                    }
                }
            }
        };
        function getSequence(arr) {
            var p = arr.slice();
            var result = [0];
            var i, j, u, v, c;
            var len = arr.length;
            for (i = 0; i < len; i++) {
                var arrI = arr[i];
                if (arrI !== 0) {
                    j = result[result.length - 1];
                    if (arr[j] < arrI) {
                        p[i] = j;
                        result.push(i);
                        continue;
                    }
                    u = 0;
                    v = result.length - 1;
                    while (u < v) {
                        c = ((u + v) / 2) | 0;
                        if (arr[result[c]] < arrI) {
                            u = c + 1;
                        }
                        else {
                            v = c;
                        }
                    }
                    if (arrI < arr[result[u]]) {
                        if (u > 0) {
                            p[i] = result[u - 1];
                        }
                        result[u] = i;
                    }
                }
            }
            u = result.length;
            v = result[u - 1];
            while (u-- > 0) {
                result[u] = v;
                v = p[v];
            }
            return result;
        }
        var patchChildren = function (n1, n2, el) {
            var c1 = n1.children; // 获取所有老的节点
            var c2 = n2.children; // 获取新的所有的节
            var prevShapeFlag = n1.shapeFlag; // 上一次元素的类型 
            var shapeFlag = n2.shapeFlag; // 这一次的元素类型
            if (shapeFlag & 8 /* TEXT_CHILDREN */) { // 文本元素
                // 老的是文本 新的是文本 =》 新的覆盖掉老的
                // 老的是数组 新的是文本 =》 覆盖掉老的即可
                if (c2 !== c1) {
                    hostSetElementText(el, c2);
                }
            }
            else {
                // 新的是数组 
                if (prevShapeFlag & 16 /* ARRAY_CHILDREN */) {
                    // 老的是数组 新的是数组 =》 diff算法
                    patchKeydChildren(c1, c2, el);
                }
                else {
                    //新的是数组  老的可能是文本
                    if (prevShapeFlag & 8 /* TEXT_CHILDREN */) {
                        // 移除老的文本
                        hostSetElementText(el, '');
                    }
                    if (shapeFlag & 16 /* ARRAY_CHILDREN */) {
                        // 去把新的元素进行挂在 生成新的节点塞进去
                        for (var i = 0; i < c2.length; i++) {
                            patch(null, c2[i], el);
                        }
                    }
                }
            }
        };
        var patchElement = function (n1, n2, container) {
            // 如果n1 和 n2 的类型一样
            var el = (n2.el = n1.el); // 
            var oldProps = n1.props || {};
            var newProps = n2.props || {};
            patchProps(oldProps, newProps, el); // 比对前后属性的元素差异
            patchChildren(n1, n2, el);
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
                    patch(prev, next, container);
                }
            });
        };
        var processElement = function (n1, n2, container, anchor) {
            if (n1 == null) {
                mountElement(n2, container, anchor);
            }
            else {
                // 比较两个虚拟节点
                patchElement(n1, n2);
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
        var isSameVnodeType = function (n1, n2) {
            return n1.type == n2.type && n1.key === n2.key;
        };
        var patch = function (n1, n2, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            var shapeFlag = n2.shapeFlag;
            // 20  组件孩子里有数组
            // 10000
            // 01000
            if (n1 && !isSameVnodeType(n1, n2)) {
                // 删除老节点 老节点的虚拟节点上对应着真实节点
                hostRemove(n1.el); // removeChild
                n1 = null;
            }
            //console.log(n1,n2)
            if (shapeFlag & 1 /* ELEMENT */) { // 都是1 才是1
                processElement(n1, n2, container, anchor);
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
