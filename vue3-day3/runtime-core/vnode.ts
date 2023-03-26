import { isArray, isObject, isString, ShapeFlags } from "../shared"

export function createVnode(type, props: any = {}, children = null) {
    // type 是什么类型？
    const shapeFlag = isString(type) ? 
        ShapeFlags.ELEMENT :
        isObject(type) ? 
        ShapeFlags.STATEFUL_COMPONENT : 0


    const vnode = { // 虚拟节点可以表示dom结构,也可以用来表示组件
        type,
        props,
        children,
        component: null, // 组件的实例
        el: null, // 虚拟节点要和真实节点做一个映射关系
        key: props.key,
        shapeFlag // vue3 里面非常优秀的做法  虚拟节点的类型  元素 、 组件
    }
    if(isArray(children)){
        // 1  16
        // 00000001
        // 00001000  
        // 00001001
        vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN; // 如果在或的过程中有一个是1就是1 把两个数相加
    }else{
        // 1  8 = 9
        // 4 || 16
        // 00000100
        // 00001000 // 1100
        vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN; 
    }
    return vnode;
}