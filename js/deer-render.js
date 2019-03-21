/**
 * @module DEER Data Encoding and Exhibition for RERUM
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>

 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

import {default as DEER} from './config.js'
import {default as UTILS} from './deer-utils.js'

const changeLoader = new MutationObserver(renderChange)

export class DeerRender {
    constructor(elem){
        changeLoader.observe(elem, {
            attributes:true
        })
        this.$dirty = false
        this.id = elem.getAttribute(DEER.ID)
        this.elem = elem

        try {
            fetch(this.id).then(response=>response.json()).then(obj=>RENDER.element(this.elem,obj))
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
		if (mutation.attributeName === DEER.ID) {
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
			RENDER.element(mutation.target,obj)
		}
	}
}

const RENDER = {}
const TEMPLATES = {}

RENDER.element = function(elem,obj) {
    let template = elem.getAttribute(DEER.TEMPLATE)
    elem.innerHTML = TEMPLATES[template || "json"](obj)
}

/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json to be drawn as JSON
 * @param {Object} options additional properties to draw with the JSON
 */
TEMPLATES.json = function(obj, options={}) {
    let indent = options.indent || 4
    let replacer = options.replacer || null
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
    let label = obj[options.label]||obj.name||obj.label
    let tmpl = `<h2>${(label)?UTILS.getValue(label):"[ unlabeled ]"}</h2>`
    let list = ``

    for (let key in obj) {
        if(DEER.SUPPRESS.indexOf(key)>-1) {continue}
        let label = obj[key].label || obj[key].name || obj[key].title|| obj[key].type || obj[key]['@type']  || key
        let value = UTILS.getValue(obj[key])
        try {
            if ((value.image || value.trim()).length > 0) {
                list += (label === "depiction") ? `<img title="${label}" src="${value.image || value}" deer-source="${obj[key].source}">` : `<dt deer-source="${obj[key].source}">${label}</dt><dd>${value.image || value}</dd>`
            }
        } catch (err) {
            // Some object maybe or untrimmable somesuch
            // is it object/array?
            if(Array.isArray(value)){
                list+=`<dt>${label}</dt>`
                value.forEach((val,index)=>{
                    let name = val.label || val.name || val.title || val.type || val['@type'] || label+index
                    list+= (val["@id"]) ? `<dd><a href="#${val["@id"]}">${name}</a></dd>` : `<dd>${name}</dd>`
                })
            }
            // TODO: handle single object?
        }
    }
    tmpl += (list.includes("<dd>")) ? `<dl>${list}</dl>` : ``
    return tmpl
}
/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json of type Person to be drawn
 * @param {Object} options additional properties to draw with the Person
 */
TEMPLATES.person= function(obj, options={}) {
    try {
        let label = UTILS.getValue(obj.label)||UTILS.getValue(obj.name)||UTILS.getValue(obj.label)||"[ unlabeled ]"
        //let prop = this.TEMPLATES.prop(obj, options.birthDate || "birthDate", "Birth Date") + TEMPLATES.prop(obj, options.deathDate || "deathDate", "Death Date") //Too many errors
        let prop = this.TEMPLATES.prop(obj, "birthDate", "Birth Date") + this.TEMPLATES.prop(obj, "deathDate", "Death Date")
        //let dep = this.renderDepiction(obj, options) TODO need to write this function
        //let famName = UTILS.getValue(obj[options.familyName])||UTILS.getValue(obj.familyName)||"[ unknown ]"
        //let givenName = UTILS.getValue(obj[options.givenName])||UTILS.getValue(obj.givenName)||""
        let famName = UTILS.getValue(obj.familyName)||"[ unknown ]"
        let givenName = UTILS.getValue(obj.givenName)||""
        let elem = `<label>Label: ${label}</label>`
        elem += `<div class="mc-name">Name: ${famName}, ${givenName}</div>`
        elem += prop
        //elem += dep 
        return elem
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
        let elem = `<h1> EVENT </h1>`
        return elem
    } catch (err) {
        return null
    }
    return null
}