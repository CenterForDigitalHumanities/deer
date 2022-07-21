import { default as UTILS } from '/js/deer-utils.js'
import { default as DEER } from '/js/deer-config.js'
import DeerView from './view.js'

const template = obj => {
    let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
    let list = ``

    for (let key in obj) {
        if (DEER.SUPPRESS.indexOf(key) > -1) { continue }
        let label = key
        let value = UTILS.getValue(obj[key], key)
        if (value.image?.length > 0) {
            list += (label === "depiction") ? `<img title="${label}" src="${value.image ?? value}" ${DEER.PREFIX}-${DEER.SOURCE}="${UTILS.getValue(obj[key].source, "citationSource")}">` : `<dt ${DEER.PREFIX}-source="${UTILS.getValue(obj[key].source, "citationSource")}">${label}</dt><dd>${value.image ?? value}</dd>`
            continue
        }
        // is it object/array?
        list += `<dt>${label}</dt>`
        if (Array.isArray(value)) {
            value.filter(undefinedCheck=>undefinedCheck!==undefined).forEach((v, index) => list += (v["@id"]) ? `<dd><a href="#${v["@id"]}">${UTILS.getLabel(v, (v.type ?? v['@type'] ?? label + '' + index))}</a></dd>` : `<dd ${DEER.PREFIX}-${DEER.SOURCE}="${UTILS.getValue(v.source, "citationSource")}">${UTILS.getValue(v)}</dd>`)
        } else {
            // a single, probably
            // TODO: export buildValueObject() from UTILS for use here
            if (typeof value === "string") {
                value = {
                    value: value,
                    source: {
                        citationSource: obj['@id'] || obj.id || "",
                        citationNote: "Primitive object from DEER",
                        comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/deer"
                    }
                }
            }
            let v = UTILS.getValue(value)
            if (typeof v === "object") { v = UTILS.getLabel(v) }
            if (v === "[ unlabeled ]") { v = v['@id'] || v.id || "[ complex value unknown ]" }
            list += (value && value['@id']) ? `<dd ${DEER.SOURCE}="${UTILS.getValue(value.source, "citationSource")}"><a href="${options.link || ""}#${value['@id']}">${v}</a></dd>` : `<dd ${DEER.SOURCE}="${UTILS.getValue(value, "citationSource")}">${v}</dd>`
        }
    }
    if (list.includes("</dd>")) { tmpl+=`<dl>${list}</dl>` }
    return tmpl
}

export default class ViewEntity extends DeerView {
    static get observedAttributes() { return [`${DEER.PREFIX}-id`,`${DEER.PREFIX}-listening`] }

    constructor() {
        super()
        this.template = template
    }

    connectedCallback() {
        this.innerHTML = `<small>&copy;2022 Research Computing Group</small>`
        UTILS.worker.addEventListener('message', e => {
            if (e.data.id !== this.getAttribute(`${DEER.PREFIX}-${DEER.ID}`)) { return }
            if(e.data.action === DEER.EVENTS.EXPANDED) {
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
                let id = this.getAttribute(`${DEER.PREFIX}-${DEER.ID}`)
                if (id === null || this.getAttribute(DEER.COLLECTION)) { return }
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

customElements.define(`${DEER.PREFIX}-entity`, ViewEntity)
