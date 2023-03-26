import { effect } from "../reactivity";
import { ShapeFlags } from "../shared";
import { createAppAPI } from "./apiCreateApp"; // 用会调用的createApp方法
import { createComponentInstace, setupComponent } from "./component";

export function createRenderer(options) { // options 是平台传过来的方法，不同的平台可以实现不同的操作逻辑
    return baseCreateRenderer(options);
}
// vue2 compile模块
function baseCreateRenderer(options) {

    const {
        createElement: hostCreateElement,
        patchProp: hostPatchProp,
        setElementText: hostSetElementText,
        insert: hostInsert,
        remove: hostRemove
    } = options;

    const mountElement = (vnode, container, anchor) => {
        // n2 虚拟节点   container就是容器
        let { shapeFlag, props } = vnode;
        let el = vnode.el = hostCreateElement(vnode.type);

        // 创建儿子节点
        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            hostSetElementText(el, vnode.children);
        } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            mountChildren(vnode.children, el);
        }
        if (props) {
            for (let key in props) {
                hostPatchProp(el, key, null, props[key]);
            }
        }
        hostInsert(el, container, anchor)
    }
    const mountChildren = (children, container) => {
        for (let i = 0; i < children.length; i++) {
            patch(null, children[i], container)
        }
    }
    const patchProps = (oldProps, newProps, el) => {
        if (oldProps !== newProps) {
            // 新的属性 需要覆盖掉老的
            for (let key in newProps) {
                const prev = oldProps[key];
                const next = newProps[key];
                if (prev !== next) {
                    hostPatchProp(el, key, prev, next);
                }
            }
            // 老的有的属性 新的没有 将老的删除掉

            for (const key in oldProps) {
                if (!(key in newProps)) {
                    hostPatchProp(el, key, oldProps[key], null);
                }
            }
        }
    }
    const patchKeydChildren = (c1, c2, el) => {
        // 内部有优化策略 
        // abc    i = 0
        // abde  从头比
        let i = 0;
        let e1 = c1.length - 1; // 老儿子中最后一项的索引
        let e2 = c2.length - 1; // 新儿子中最后一项的索引
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = c2[i];
            if (isSameVnodeType(n1, n2)) {
                patch(n1, n2, el); // 会递归比对子元素
            } else {
                break;
            }
            i++;
        }
        // abc // e1 = 2
        //eabc // e2 = 3 // 从后比
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = c2[e2];
            if (isSameVnodeType(n1, n2)) {
                patch(n1, n2, el);
            } else {
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
                const nextPos = e2 + 1;
                const anchor = nextPos < c2.length ? c2[nextPos].el : null;
                while (i <= e2) {
                    patch(null, c2[i], el, anchor);
                    i++;
                }
            }
            // abcd  abc (i=3  e1=3  e2=2)
        } else if (i > e2) { // 删除
            while (i <= e1) {
                hostRemove(c1[i].el);
                i++;
            }
        } else {
            // 无规律的情况 diff 算法
            // ab [cde] fg   // s1=2  e1=4  
            // ab [dech] fg  //  s2=2  e2=5;  => [5,4,3,0]; 无视他
            const s1 = i;
            const s2 = i;
            // 新的索引 和 key 做成一个映射表
            const keyToNewIndexMap = new Map();
            for (let i = s2; i <= e2; i++) {
                const nextChild = c2[i];
                keyToNewIndexMap.set(nextChild.key, i);
            }
            const toBePatched = e2 - s2 + 1;
            const newIndexToOldMapIndex = new Array(toBePatched).fill(0);

            // 只是做相同属性的diff 但是位置可能还不对
            for (let i = s1; i <= e1; i++) {
                const prevChild = c1[i];
                let newIndex = keyToNewIndexMap.get(prevChild.key); // 获取新的索引
                if (newIndex == undefined) {
                    hostRemove(prevChild.el); // 老的有 新的没有直接删除
                } else {
                    newIndexToOldMapIndex[newIndex - s2] = i + 1;
                    patch(prevChild, c2[newIndex], el);
                }
            }
            //  最长增长序列 [0,1]  [0,1,2,3]
            let increasingIndexSequence = getSequence(newIndexToOldMapIndex)

            let j = increasingIndexSequence.length - 1;

            for (let i = toBePatched - 1; i >= 0; i--) {
                const nextIndex = s2 + i; // [edch]   找到h的索引 
                const nextChild = c2[nextIndex]; // 找到 h
                let anchor = nextIndex + 1 < c2.length ? c2[nextIndex + 1].el : null; // 找到当前元素的下一个元素
                if (newIndexToOldMapIndex[i] == 0) { // 这是一个新元素 直接创建插入到 当前元素的下一个即可
                    patch(null, nextChild, el, anchor)
                } else {
                    // 根据参照物 将节点直接移动过去  所有节点都要移动 （但是有些节点可以不动）
                    if(j < 0 || i != increasingIndexSequence[j]){
                    // 此时没有考虑不动的情况 
                        hostInsert(nextChild.el, el, anchor);
                    }else{
                        j--;
                    }
                }
            }
        }
    }


    function getSequence(arr) {
        const p = arr.slice()
        const result = [0]
        let i, j, u, v, c
        const len = arr.length
        for (i = 0; i < len; i++) {
            const arrI = arr[i]
            if (arrI !== 0) {
                j = result[result.length - 1]
                if (arr[j] < arrI) {
                    p[i] = j
                    result.push(i)
                    continue
                }
                u = 0
                v = result.length - 1
                while (u < v) {
                    c = ((u + v) / 2) | 0
                    if (arr[result[c]] < arrI) {
                        u = c + 1
                    } else {
                        v = c
                    }
                }
                if (arrI < arr[result[u]]) {
                    if (u > 0) {
                        p[i] = result[u - 1]
                    }
                    result[u] = i
                }
            }
        }
        u = result.length
        v = result[u - 1]
        while (u-- > 0) {
            result[u] = v
            v = p[v]
        }
        return result
    }

    const patchChildren = (n1, n2, el) => {
        const c1 = n1.children; // 获取所有老的节点
        const c2 = n2.children; // 获取新的所有的节
        const prevShapeFlag = n1.shapeFlag; // 上一次元素的类型 
        const shapeFlag = n2.shapeFlag; // 这一次的元素类型

        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) { // 文本元素
            // 老的是文本 新的是文本 =》 新的覆盖掉老的
            // 老的是数组 新的是文本 =》 覆盖掉老的即可
            if (c2 !== c1) {
                hostSetElementText(el, c2);
            }
        } else {
            // 新的是数组 
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                // 老的是数组 新的是数组 =》 diff算法
                patchKeydChildren(c1, c2, el);
            } else {
                //新的是数组  老的可能是文本
                if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
                    // 移除老的文本
                    hostSetElementText(el, '');
                }
                if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    // 去把新的元素进行挂在 生成新的节点塞进去
                    for (let i = 0; i < c2.length; i++) {
                        patch(null, c2[i], el);
                    }
                }
            }
        }
    }
    const patchElement = (n1, n2, container) => {
        // 如果n1 和 n2 的类型一样
        let el = (n2.el = n1.el); // 
        const oldProps = n1.props || {};
        const newProps = n2.props || {};

        patchProps(oldProps, newProps, el); // 比对前后属性的元素差异

        patchChildren(n1, n2, el);
    }
    const mountComponent = (initialVnode, container) => {
        // 组件挂载逻辑  1.创建组件的实例 2.找到组件的render方法 3.执行render
        // 组件实例要记录当前组件的状态
        const instance = initialVnode.component = createComponentInstace(initialVnode);

        setupComponent(instance); // 找到组件的setup方法

        // 调用render方法， 如果render方法中数据变化了 会重新渲染

        setupRenderEffect(instance, initialVnode, container); // 给组件创建一个effect 用于渲染 == vue2 watcher
    }
    const setupRenderEffect = (instance, initialVnode, container) => {
        effect(function componentEffect() {
            if (!instance.isMounted) {
                // 渲染组件中的内容
                const subTree = instance.subTree = instance.render(); // 组件对应渲染的结果
                patch(null, subTree, container)
                instance.isMounted = true;
            } else {
                // 更新逻辑
                let prev = instance.subTree // 上一次的渲染结果
                let next = instance.render();
                patch(prev, next, container);
            }
        })
    }
    const updateComponent = (n1, n2, container) => { }
    const processElement = (n1, n2, container, anchor) => {
        if (n1 == null) {
            mountElement(n2, container, anchor);
        } else {
            // 比较两个虚拟节点
            patchElement(n1, n2, container)
        }
    }
    const processComponent = (n1, n2, container) => {
        if (n1 == null) {
            mountComponent(n2, container);
        } else {
            updateComponent(n1, n2, container);
        }
    }
    const render = (vnode, container) => {
        // 我需要将虚拟节点  变成真实节点 挂载到容器上
        patch(null, vnode, container)
    }

    const isSameVnodeType = (n1, n2) => {
        return n1.type == n2.type && n1.key === n2.key
    }

    const patch = (n1, n2, container, anchor = null) => {
        let { shapeFlag } = n2;
        // 20  组件孩子里有数组
        // 10000
        // 01000
        if (n1 && !isSameVnodeType(n1, n2)) {
            // 删除老节点 老节点的虚拟节点上对应着真实节点
            hostRemove(n1.el); // removeChild
            n1 = null
        }
        //console.log(n1,n2)


        if (shapeFlag & ShapeFlags.ELEMENT) { // 都是1 才是1
            processElement(n1, n2, container, anchor);
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
            processComponent(n1, n2, container);
        }
    }

    return {
        createApp: createAppAPI(render)
    }
}