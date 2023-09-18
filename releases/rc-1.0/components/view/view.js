/**
 * Base element for rendering an entity in the DOM. The template is a simple <pre> tag with the JSON-LD data rendered in it. 
 * Developers can add their own classes by extending this or add a simpler element with a custom template.
 * 
 * @export default class DeerView
 * @definition {HTMLElement} deer-view
 * @author Patrick Cuba <cubap@slu.edu>
 * @org SLU, Research Computing Group
 */

 import { UTILS, DEER } from '//deer.rerum.io/releases/rc-1.0/js/deer-utils.js'
 import '//deer.rerum.io/releases/rc-1.0/components/templates/default.js'
 

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

    Entity

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
        this.template = this.#options.config.TEMPLATES[this.getAttribute(this.#options.config.TEMPLATE)] ?? template
    }

    config(configObj={}) { 
        Object.assign(this.#options.config, configObj)
        this.render()
        return this
    }

    render() {this.innerHTML = this.template(this.Entity,this.#options)}

    connectedCallback() {
        this.innerHTML = `<small>&copy;2022 Research Computing Group</small>`
        UTILS.worker.addEventListener('message', e => {
            if (e.data.id !== this.getAttribute(this.#options.config.ID)) { return }
            switch (e.data.action) {
                case "reload":
                case "update":
                    if(UTILS.objectMatch(this.Entity,e.data.payload)){ return }
                    this.Entity = e.data.payload
                    this.render()
                default:
            }
        })
    }

    disconnectedCallback() { }
    adoptedCallback() { }
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case this.#options.config.ID:
            case this.#options.config.KEY:
            case this.#options.config.LINK:
            case this.#options.config.LIST:
                const id = this.getAttribute(this.#options.config.ID)
                if (id === null || this.getAttribute(this.#options.config.COLLECTION)) { return }
                UTILS.postView(id, Boolean(this.getAttribute(this.#options.config.LAZY)))
                break
            case this.#options.config.LISTENING:
                const listensTo = this.getAttribute(this.#options.config.LISTENING)
                if (!listensTo) {
                    console.warn(`There is no HTML element with id ${this.getAttribute(this.#options.config.LISTENING)} to attach an event to`)
                    return
                }
                document.addEventListener(this.#options.config.EVENTS.SELECTED, e => {
                    let listenID = e.detail.target?.closest(`[${this.#options.config.ID}][id]`)?.id
                    if (listenID === listensTo) {
                        this.setAttribute(this.#options.config.ID, e.detail.target?.closest(`[${this.#options.config.ID}]`)?.getAttribute(this.#options.config.ID))
                    }
                })
                window[listensTo]?.addEventListener("click", e => UTILS.broadcast(e, this.#options.config.EVENTS.SELECTED, window[listensTo]))
            default:
                break

        }
    }
}

customElements.define(`deer-view`, DeerView)
