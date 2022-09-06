/**
 * Base element for rendering an entity in the DOM. The template is a simple <pre> tag with the JSON-LD data rendered in it. 
 * Developers can add their own classes by extending this or add a simpler element with a custom template.
 * 
 * @export default class DeerView
 * @definition {HTMLElement} deer-view
 * @author Patrick Cuba <cubap@slu.edu>
 * @org SLU, Research Computing Group
 */

import { UTILS, DEER } from '/js/deer-utils.js'
import '/components/templates/default.js'

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
    static get observedAttributes() { return [DEER.ID, DEER.KEY, DEER.LIST, DEER.LINK, DEER.LAZY, DEER.LISTENING]; }

    #options = {
        list: this.getAttribute(DEER.LIST),
        link: this.getAttribute(DEER.LINK),
        collection: this.getAttribute(DEER.COLLECTION),
        key: this.getAttribute(DEER.KEY),
        label: this.getAttribute(DEER.LABEL),
        config: DEER
    }
    constructor() {
        super()
        this.template = DEER.TEMPLATES[this.getAttribute(DEER.TEMPLATE)] ?? template
    }

    connectedCallback() {
        this.innerHTML = `<small>&copy;2022 Research Computing Group</small>`
        UTILS.worker.addEventListener('message', e => {
            if (e.data.id !== this.getAttribute(DEER.ID)) { return }
            switch (e.data.action) {
                case "update":
                    this.innerHTML = this.template(e.data.payload,this.#options)
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
        switch (name) {
            case DEER.ID:
            case DEER.KEY:
            case DEER.LINK:
            case DEER.LIST:
                const id = this.getAttribute(DEER.ID)
                if (id === null || this.getAttribute(DEER.COLLECTION)) { return }
                UTILS.postView(id, Boolean(this.getAttribute(DEER.LAZY)))
                break
            case DEER.LISTENING:
                const listensTo = this.getAttribute(DEER.LISTENING)
                if (!listensTo) {
                    console.warn(`There is no HTML element with id ${this.getAttribute(DEER.LISTENING)} to attach an event to`)
                    return
                }
                document.addEventListener(DEER.EVENTS.SELECTED, e => {
                    let listenID = e.detail.target?.closest(`[${DEER.ID}][id]`)?.id
                    if (listenID === listensTo) {
                        this.setAttribute(DEER.ID, e.detail.target?.closest(`[${DEER.ID}]`)?.getAttribute(DEER.ID))
                    }
                })
                window[listensTo]?.addEventListener("click", e => UTILS.broadcast(e, DEER.EVENTS.SELECTED, window[listensTo]))
            default:
                break

        }
    }
}

customElements.define(`deer-view`, DeerView)
