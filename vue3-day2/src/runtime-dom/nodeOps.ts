export const nodeOps = {
    createElement(type){
        return document.createElement(type);
    },
    setElementText(el,text){
        el.textContent = text;
    },
    insert(child,parent,anchor=null){
        parent.insertBefore(child,anchor); // appendChild
    },
    remove(child){
        const parent = child.parentNode;
        if(parent){
            parent.removeChild(child)
        }
    }
}