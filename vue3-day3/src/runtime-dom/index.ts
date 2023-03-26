
import { createRenderer } from "../runtime-core";
import { nodeOps } from "./nodeOps";
import { patchProp } from "./patchProp";



const renderOptions = {...nodeOps,patchProp}; // dom操作

function ensureRenderer(){
    return createRenderer(renderOptions)
}

//  createApp(App).mount('#app');
export function createApp(rootComponent){
    // 1.根据组件 创建一个渲染器
    const app = ensureRenderer().createApp(rootComponent);
    const {mount} = app
    app.mount = function (container) {  
        container = document.querySelector(container)
        // 1.挂载时需要将容器清空 在进行挂载
        container.innerHTML = ''
        mount(container);
    }
    return app
}
// reactive