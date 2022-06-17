import { default as UTILS } from '../../js/deer-utils'
import { default as config } from '../../js/deer-config'

class DeerView extends HTMLElement {
    static get observedAttributes() { return [`${config.PREFIX}-id`,`${config.PREFIX}-key`,`${config.PREFIX}-list`,`${config.PREFIX}-link`,`${config.PREFIX}-listening`]; }

    constructor() {
        super()
    }

    connectedCallback() {
        this.innerHTML = `<small>&copy;2022 Research Computing Group</small>`

    }

    disconnectedCallback(){}
    adoptedCallback(){}
    attributeChangedCallback(name, oldValue, newValue){
        switch (name.split(',')[1]) {
            case 'id':
            case 'key':
            case 'link':
            case 'list':
                let id = mutation.target.getAttribute(DEER.ID)
                if (id === "null" || mutation.target.getAttribute(DEER.COLLECTION)) return
                let obj = await fetch(id).then(response => response.json()).catch(error => error)
                if (!obj) return false
                RENDER.element(mutation.target, obj)
                break
            case 'listening':
                let listensTo = mutation.target.getAttribute(DEER.LISTENING)
                if (listensTo) {
                    mutation.target.addEventListener(DEER.EVENTS.CLICKED, e => {
                        let loadId = e.detail["@id"]
                        if (loadId === listensTo) { mutation.target.setAttribute("deer-id", loadId) }
                    })
                }
        }
        if (mutation.type === 'childList') {
            RENDER.detectInsertions(elem)
        }
    }
}

customElements.define(`${config.PREFIX}-view`, DeerView)