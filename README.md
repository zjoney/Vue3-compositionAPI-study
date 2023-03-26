# vue3 + TS 实战以及 rollup 打包

- Vue2.0采用flow进行编写，而3.0源码全部采用Typescript进行开发，对Typescript支持友好 

- 源码体积优化：移除部分api，使用tree-shaking

- 数据劫持优化：Vue3采用Proxy，性能大大提升

- 编译优化：Vue3实现了静态模板分析、重写diff算法

- CompositionAPl：整合业务代码的逻辑，提取公共逻辑（vue2采用mixin—命名冲突数据来源不清晰析）

- 自定义渲染器：可以用来创建自定义的渲染器。改写Vue底层渲染逻辑

- 新增Fragment、Teleport、Suspense组件

# Vue3-compositionAPI-study
CompositionAPI# 在Vue2中采用的是OptionsAPI, 用户提供的data,props,methods,computed,watch等属性 (用户编写复杂业务逻辑会出现反复横跳问题) Vue2中所有的属性都是通过this访问，this存在指向明确问题 Vue2中很多未使用方法或属性依旧会被打包，并且所有全局API都在Vue对象上公开。Composition API对 tree-shaking 更加友好，代码也更容易压缩。 组件逻辑共享问题， Vue2 采用mixins 实现组件之间的逻辑共享； 但是会有数据来源不明确，命名冲突等问题。 Vue3采用CompositionAPI 提取公共逻辑非常方便
