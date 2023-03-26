import { track, trigger } from "./effect";
import { hasChanged, hasOwn, isArray, isInteger, isObject, isSymbol } from "../shared/index";
import { reactive } from "./reactive";

function createGetter() {
    return function get(target, key, receiver) {// 获取对象中的属性会执行此方法
        const res = Reflect.get(target, key, receiver); // target[key];
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
    }
}
function createSetter() {
    return function set(target, key, value, receiver) { // 设置属性值的时候会执行此方法
        // vue2不支持新增属性
        // 新增还是修改?
        const oldValue = target[key]; // 如果是修改那肯定有老值
        // 看一下有没有这个属性 
        // 第一种是 数组新增的逻辑  第二种是对象的逻辑
        const hadKey = isArray(target) && isInteger(key) ? Number(key) < target.length : hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver); //  target[key] = value;

        // 新增属性是对象无所谓 ，只有取的时候才会做代理
        if (!hadKey) {
            trigger(target, 'add', key, value);

        } else if (hasChanged(value, oldValue)) {
            trigger(target, 'set', key, value, oldValue);
        }
        return result;
    }
}
const get = createGetter(); // 为了预置参数
const set = createSetter();

export const mutableHandlers = {
    get,
    set
}