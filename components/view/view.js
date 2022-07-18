import { default as UTILS } from '../../deer-utils.js'
import { default as DEER } from '../../deer-config.js'

class DeerView extends HTMLElement {
    static get observedAttributes() { return [`${DEER.PREFIX}-id`,`${DEER.PREFIX}-key`,`${DEER.PREFIX}-list`,`${DEER.PREFIX}-link`,`${DEER.PREFIX}-listening`]; }

    constructor() {
        super()
        this.template = DEER.TEMPLATES[(this.getAttribute(DEER.TEMPLATE) || "default")]
    }

    connectedCallback() {
        this.innerHTML = `<small>&copy;2022 Research Computing Group</small>`
        UTILS.worker.addEventListener('message', e => {
            if (e.data.id !== this.getAttribute(DEER.ID)) { return }
            if(e.data.action === "expanded"){
                console.log("rendering expanded view")
                this.innerHTML = this.template(e.data.item)
            }
        })
    }

    disconnectedCallback(){}
    adoptedCallback(){}
    attributeChangedCallback(name, oldValue, newValue){
        switch (name.split('-')[1]) {
            case 'id':
            case 'key':
            case 'link':
            case 'list':
                let id = this.getAttribute(DEER.ID)
                if (id === "null" || this.getAttribute(DEER.COLLECTION)) { return }
                UTILS.postView(id)
                break
            case 'listening':
                let listensTo = this.getAttribute(DEER.LISTENING)
                if (listensTo) {
                    this.addEventListener(DEER.EVENTS.CLICKED, e => {
                        let loadId = e.detail["@id"]
                        if (loadId === listensTo) { this.setAttribute("deer-id", loadId) }
                    })
                }
        }
        if (name === 'childList') {
            RENDER.detectInsertions(elem)
        }
    }
}

customElements.define(`${DEER.PREFIX}-view`, DeerView)
