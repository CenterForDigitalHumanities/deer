import { default as UTILS } from '/js/deer-utils.js'
import { default as DEER } from '/js/deer-config.js'

const template = (obj, options = {}) => {
    let indent = options.indent ?? 4
    let replacer = (k, v) => {
        if (DEER.SUPPRESS.indexOf(k) !== -1) return
        return v
    }
    try {
        return `<pre>${JSON.stringify(obj, replacer, indent)}</pre>`
    } catch (err) {
        return null
    }
}

export default class DeerView extends HTMLElement {
    static get observedAttributes() { return [DEER.ID, DEER.KEY, DEER.LIST, DEER.LINK, DEER.LISTENING]; }

    constructor() {
        super()
        this.template = template
    }

    connectedCallback() {
        this.innerHTML = `<small>&copy;2022 Research Computing Group</small>`
        UTILS.worker.addEventListener('message', e => {
            if (e.data.id !== this.getAttribute(DEER.ID)) { return }
            switch (e.data.action) {
                case "update":
                    this.innerHTML = this.template(e.data.payload)
                    break
                case "reload":
                    this.Entity = e.data.payload
                default:
            }
        })
    }

    disconnectedCallback() { }
    adoptedCallback() { }
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name.split('-')[1]) {
            case DEER.ID:
            case DEER.KEY:
            case DEER.LINK:
            case DEER.LIST:
                const id = this.getAttribute(DEER.ID)
                if (id === null || this.getAttribute(DEER.COLLECTION)) { return }
                UTILS.postView(id)
                break
            case DEER.LISTENING:
                const listensTo = this.getAttribute(DEER.LISTENING)
                if (!listensTo) {
                    console.warn(`There is no HTML element with id ${this.getAttribute(DEER.LISTENING)} to attach an event to`)
                    return
                }
                this.addEventListener(DEER.EVENTS.SELECTED, e => {
                    let selectID = e.detail.target?.closest(`[${DEER.ID}]`)?.id
                    if (selectID === listensTo) {
                        this.setAttribute(DEER.ID, selectID.getAttribute(DEER.ID))
                    }
                })
                window[listensTo]?.addEventListener("click", e => UTILS.broadcast(e, DEER.EVENTS.SELECTED, window[listensTo]))
            default:
                break
        }
    }
}

customElements.define(`deer-view`, DeerView)
