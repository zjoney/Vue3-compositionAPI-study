export const enum ShapeFlags {
    ELEMENT = 1,
    FUNCTIONAL_COMPONENT = 1 << 1,// 2
    STATEFUL_COMPONENT = 1 << 2, // 4
    TEXT_CHILDREN = 1 << 3, // 8
    ARRAY_CHILDREN = 1 << 4, // 16
}


