/**
 * @module DEER Data Encoding and Exhibition for RERUM
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>

 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

import { default as UTILS } from './deer-utils.js'
import { default as DEER } from './deer-config.js'

const changeLoader = new MutationObserver(renderChange)

export default class DeerRender {
    constructor(elem){
        changeLoader.observe(elem, {
            attributes:true
        })
        this.$dirty = false
        this.id = elem.getAttribute(DEER.ID)
        this.elem = elem

        let listensTo = elem.getAttribute(DEER.LISTENING)
        if(listensTo){
            elem.addEventListener('deer-load',e=>{
                let loadId = e.detail["@id"]
                if(loadId===listensTo) { elem.setAttribute("deer-id",loadId) }
            })
        }

        try {
            if(!this.id){
                throw new Error(this.id+" is not a valid id.")
            }
            fetch(this.id).then(response=>response.json()).then(obj=>RENDER.element(this.elem,obj)).catch(err=>err)
        } catch(err){}
    }
}

/**
 * Observer callback for rendering newly loaded objects. Checks the
 * mutationsList for "deep-object" attribute changes.
 * @param {Array} mutationsList of MutationRecord objects
 */
async function renderChange(mutationsList) {
	for (var mutation of mutationsList) {
		switch (mutation.attributeName) {
            case DEER.ID:
                let id = mutation.target.getAttribute(DEER.ID)
                if (id === "null") return
                let obj = {}
                try {
                    obj = JSON.parse(localStorage.getItem(id))
                } catch (err) {}
                if (!obj || !(obj.items || obj.images || obj.sequences)) {
                    obj = await fetch(id).then(response => response.json()).catch(error => error)
                    if (obj) {
                        localStorage.setItem(obj["@id"] || obj.id, JSON.stringify(obj))
                    } else {
                        return false
                    }
                }
            case DEER.COLLECTION:
            case DEER.LIST:
            case DEER.KEY:
            case DEER.LINK:
                RENDER.element(mutation.target,obj)
                break
            case DEER.LISTENING:
                let listensTo = mutation.target.getAttribute(DEER.LISTENING)
                if(listensTo){
                    mutation.target.addEventListener('deer-load',e=>{
                        let loadId = e.detail["@id"]
                        if(loadId===listensTo) { mutation.target.setAttribute("deer-id",loadId) }
                    })
                }
		}
	}
}

const RENDER = {}
const TEMPLATES = {}

RENDER.element = function(elem,obj) {
    return UTILS.expand(obj).then(obj=>{
        let template = TEMPLATES[elem.getAttribute(DEER.TEMPLATE)] || TEMPLATES.json
        let options = {
            list: elem.getAttribute(DEER.LIST),
            link: elem.getAttribute(DEER.LINK),
            collection: elem.getAttribute(DEER.COLLECTION)
        }
        elem.innerHTML = template(obj,options)
        UTILS.broadcast(DEER.EVENTS.LOADED,elem,obj)
    })
}

/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json to be drawn as JSON
 * @param {Object} options additional properties to draw with the JSON
 */
TEMPLATES.json = function(obj, options={}) {
    let indent = options.indent || 4
    let replacer = (k,v) => {
        if(DEER.SUPPRESS.indexOf(k) !== -1) return
        return v
    }
    try {
        return `<pre>${JSON.stringify(obj, replacer, indent)}</pre>`
    } catch (err) {
        return null
    }
}

/**
 * Get a certain property from an object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj containing a key that needs to be drawn
 * @param {String} key the name of the key in the obj we are looking for
 * @param {String} label The label to be displayed when drawn
 */
TEMPLATES.prop= function(obj, key, label) {
    let prop = obj[key]
    //let altLabel = options.altLabel || prop
    let altLabel = label
    //let prefix = (options.prefix || "deer") + "-"
    let prefix = "deer-"
    try {
        let pattern = new RegExp("(" + prefix + ")+", "g")
        return `<span class="${(prefix+prop).trim().replace(/\s+/g,"-").replace(/:/g,"-").replace(pattern,prefix).normalize("NFC").toLowerCase()}">${altLabel || prop}: ${UTILS.getValue(obj[prop]) || "[ undefined ]"}</span>`
    } catch (err) {
        return null
    }
}

 /**
 * The TEMPLATED renderer to draw an JSON to the screen as some HTML template
 * @param {Object} obj some json of type Entity to be drawn
 * @param {Object} options additional properties to draw with the Entity
 */
TEMPLATES.entity= function(obj, options = {}) {
    let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
    let list = ``

    for (let key in obj) {
        if(DEER.SUPPRESS.indexOf(key)>-1) {continue}
        let label = key
        let value = UTILS.getValue(obj[key])
        try {
            if ((value.image || value.trim()).length > 0) {
                list += (label === "depiction") ? `<img title="${label}" src="${value.image || value}" deer-source="${obj[key].source}">` : `<dt deer-source="${obj[key].source}">${label}</dt><dd>${value.image || value}</dd>`
            }
        } catch (err) {
            // Some object maybe or untrimmable somesuch
            // is it object/array?
            list+=`<dt>${label}</dt>`
            if(Array.isArray(value)){
                value.forEach((val,index)=>{
                    let name = UTILS.getLabel(val,(val.type || val['@type'] || label+index))
                    list+= (val["@id"]) ? `<dd><a href="#${val["@id"]}">${name}</a></dd>` : `<dd>${name}</dd>`
                })
            } else {
                // a single, probably
                let v = UTILS.getValue(value)
                if(typeof v==="object") { v = UTILS.getLabel(v) }
                if(v === "[ unlabeled ]") { v = v['@id'] || v.id || "[ complex value unknown ]"}
                list+=(value['@id'])?`<dd><a href="${options.link||""}#${value['@id']}">${v}</a></dd>`:`<dd>${v}</dd>`
            }
        }
    }
    tmpl += (list.includes("<dd>")) ? `<dl>${list}</dl>` : ``
    return tmpl
}

TEMPLATES.list= function(obj, options={}) {
    let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
    if(options.list){
        tmpl += `<ul>`
        obj[options.list].forEach((val,index)=>{
            let name = UTILS.getLabel(val,(val.type || val['@type'] || label+index))
            tmpl+= (val["@id"]) ? `<li><a href="#${val["@id"]}">${name}</a></li>` : `<li>${name}</li>`
        })
        tmpl += `</ul>`
    }

    return tmpl
}
/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json of type Person to be drawn
 * @param {Object} options additional properties to draw with the Person
 */
TEMPLATES.person= function(obj, options={}) {
    try {
        let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
        let dob = TEMPLATES.prop(obj, "birthDate", "Birth Date") || ``
        let dod = TEMPLATES.prop(obj, "deathDate", "Death Date") || ``
        let famName = (obj.familyName&&UTILS.getValue(obj.familyName))||"[ unknown ]"
        let givenName = (obj.givenName&&UTILS.getValue(obj.givenName))||""
        tmpl += (obj.familyName||obj.givenName) ? `<div>Name: ${famName}, ${givenName}</div>` : ``
        tmpl += dob + dod
        tmpl += `<a href="#${obj["@id"]}">${name}</a>`
        return tmpl
    } catch (err) {
        return null
    }
    return null
}
/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json of type Event to be drawn
 * @param {Object} options additional properties to draw with the Event
 */
TEMPLATES.event= function(obj, options={}) {
    try {
        let tmpl = `<h1>${UTILS.getLabel(obj)}</h1>`
        return tmpl
    } catch (err) {
        return null
    }
    return null
}

Object.assign(TEMPLATES,DEER.TEMPLATES)