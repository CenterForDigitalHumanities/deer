/**
 * @module DeerRender Data Encoding and Exhibition for RERUM
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>
 * @version 0.7


 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

import { default as UTILS } from './deer-utils.js'
import { default as config } from './deer-config.js'

const changeLoader = new MutationObserver(renderChange)
var DEER = config

/**
 * Observer callback for rendering newly loaded objects. Checks the
 * mutationsList for "deep-object" attribute changes.
 * @param {Array} mutationsList of MutationRecord objects
 */
async function renderChange(mutationsList) {
    for (var mutation of mutationsList) {
        switch (mutation.attributeName) {
            case DEER.ID:
            case DEER.KEY:
            case DEER.LINK:
            case DEER.LIST:
            let id = mutation.target.getAttribute(DEER.ID)
            if (id === "null" || mutation.target.getAttribute(DEER.COLLECTION)) return
            let obj = {}
            try {
                obj = JSON.parse(localStorage.getItem(id))
            } catch (err) {}
            if (!obj||!obj["@id"]) {
                obj = await fetch(id).then(response => response.json()).catch(error => error)
                if (obj) {
                    localStorage.setItem(obj["@id"] || obj.id, JSON.stringify(obj))
                } else {
                    return false
                }
            }
            RENDER.element(mutation.target,obj)
            break
            case DEER.LISTENING:
            let listensTo = mutation.target.getAttribute(DEER.LISTENING)
            if(listensTo){
                mutation.target.addEventListener(DEER.EVENTS.CLICKED,e=>{
                    let loadId = e.detail["@id"]
                    if(loadId===listensTo) { mutation.target.setAttribute("deer-id",loadId) }
                })
            }
		}
	}
}

const RENDER = {}

RENDER.element = function(elem,obj) {
    
    return UTILS.expand(obj).then(obj=>{
        let tmplName = elem.getAttribute(DEER.TEMPLATE) || (elem.getAttribute(DEER.COLLECTION) ? "list" : "json")
        let template = DEER.TEMPLATES[tmplName] || DEER.TEMPLATES.json
        let options = {
            list: elem.getAttribute(DEER.LIST),
            link: elem.getAttribute(DEER.LINK),
            collection: elem.getAttribute(DEER.COLLECTION),
            key: elem.getAttribute(DEER.KEY),
            label: elem.getAttribute(DEER.LABEL),
            config: DEER
        }
        let templateResponse = template(obj,options)

        elem.innerHTML = (typeof templateResponse.html==="string") ? templateResponse.html : templateResponse

        let newViews = elem.querySelectorAll(config.VIEW)
        if(newViews.length>0) {
            UTILS.broadcast(undefined,DEER.EVENTS.NEW_VIEW,elem,{set:newViews})
        }
        let newForms = elem.querySelectorAll(config.FORM)
        if(newForms.length > 0) {
            UTILS.broadcast(undefined,DEER.EVENTS.NEW_FORM,elem,{set:newForms})
        }

        if (typeof templateResponse.then === "function") { templateResponse.then(elem,obj,options) }

        UTILS.broadcast(undefined,DEER.EVENTS.LOADED,elem,obj)
    })
}

/**
 * The TEMPLATED renderer to draw JSON to the screen
 * @param {Object} obj some json to be drawn as JSON
 * @param {Object} options additional properties to draw with the JSON
 */
DEER.TEMPLATES.json = function(obj, options={}) {
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
DEER.TEMPLATES.prop= function(obj, options = {}) {
    let key = options.key || "@id"
    let prop = obj[key]
    let label = options.label || UTILS.getLabel(obj,prop)
    try {
        return `<span class="${prop}">${label}: ${UTILS.getValue(prop) || "[ undefined ]"}</span>`
    } catch (err) {
        return null
    }
}

/**
 * The TEMPLATED renderer to draw an JSON to the screen as some HTML template
 * @param {Object} obj some json of type Entity to be drawn
 * @param {Object} options additional properties to draw with the Entity
 */
DEER.TEMPLATES.entity= function(obj, options = {}) {
    let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
    let list = ``
    
    for (let key in obj) {
        if(DEER.SUPPRESS.indexOf(key)>-1) {continue}
        let label = key
        let value = UTILS.getValue(obj[key],key)
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

DEER.TEMPLATES.list= function(obj, options={}) {
    let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
    if(options.list){
        tmpl += `<ul>`
        obj[options.list].forEach((val,index)=>{
            let name = UTILS.getLabel(val,(val.type || val['@type'] || index))
            tmpl+= (val["@id"] && options.link) ? `<li ${DEER.ID}="${val["@id"]}"><a href="${options.link}${val["@id"]}">${name}</a></li>` : `<li ${DEER.ID}="${val["@id"]}">${name}</li>`
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
DEER.TEMPLATES.person= function(obj, options={}) {
    try {
        let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
        let dob = DEER.TEMPLATES.prop(obj, {key:"birthDate", title:"Birth Date"}) || ``
        let dod = DEER.TEMPLATES.prop(obj, {key:"deathDate", title:"Death Date"}) || ``
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
DEER.TEMPLATES.event= function(obj, options={}) {
    try {
        let tmpl = `<h1>${UTILS.getLabel(obj)}</h1>`
        return tmpl
    } catch (err) {
        return null
    }
    return null
}

export default class DeerRender {
    constructor(elem, deer={}){
        for(let key in DEER) {
            if(typeof DEER[key] === "string") {
                DEER[key] = deer[key] || config[key]
            } else {
                DEER[key] = Object.assign(config[key],deer[key])
            }
        }
        changeLoader.observe(elem, {
            attributes:true
        })
        this.$dirty = false
        this.id = elem.getAttribute(DEER.ID)
        this.collection = elem.getAttribute(DEER.COLLECTION)
        this.elem = elem
        
        try {
            if(!(this.id||this.collection)){
                let err = new Error(this.id+" is not a valid id.")
                err.code = "NO_ID"
                throw err
            } else {
                if(this.id) {
                    fetch(this.id).then(response=>response.json()).then(obj=>RENDER.element(this.elem,obj)).catch(err=>err)
                } else if (this.collection) {
                    // Look not only for direct objects, but also collection annotations
                    let queryObj = {
                        $or: [{
                            "targetCollection": this.collection
                        },{
                            "body.targetCollection": this.collection
                        }]
                    }
                    fetch(DEER.URLS.QUERY, {
                        method: "POST",
                        mode: "cors",
                        body: JSON.stringify(queryObj)
                    }).then(response => response.json())
                    .then(pointers => {
                        let list = []
                        pointers.map(tc => list.push(fetch(tc.target || tc["@id"] || tc.id).then(response=>response.json().catch(err=>{__deleted:console.log(err)}))))
                        return Promise.all(list).then(l=>l.filter(i=>!i.hasOwnProperty("__deleted")))
                    })
                    .then(list => {
                        let listObj = {
                            name: this.collection,
                            itemListElement: list
                        }
                        this.elem.setAttribute(DEER.LIST,"itemListElement")
                        try {
                            listObj["@type"] = list[0]["@type"] || list[0].type || "ItemList"
                        } catch (err) {}
                        RENDER.element(this.elem,listObj)
                    })
                }
            }
        } catch(err){
            let message = err
            switch(err.code){
                case "NO_ID": message=`` // No DEER.ID, so leave it blank
            }
            elem.innerHTML = message
        }

        let listensTo = elem.getAttribute(DEER.LISTENING)
        if(listensTo){
            elem.addEventListener(DEER.EVENTS.CLICKED,e=> {
                try{
                    if(e.detail.target.closest(DEER.VIEW+","+DEER.FORM).getAttribute("id")===listensTo) elem.setAttribute(DEER.ID,e.detail.target.closest('['+DEER.ID+']').getAttribute(DEER.ID))
                } catch (err) {}
            })
            try{
                window[listensTo].addEventListener("click", e => UTILS.broadcast(e,DEER.EVENTS.CLICKED,elem))
            }
            catch (err) {
                console.error("There is no HTML element with id "+listensTo+" to attach an event to")
            }
        }
        
    }
}

export function initializeDeerViews(config) {
    const views = document.querySelectorAll(config.VIEW)
    Array.from(views).forEach(elem=>new DeerRender(elem,config))
    document.addEventListener(DEER.EVENTS.NEW_VIEW,e => Array.from(e.detail.set).forEach(elem=>new DeerRender(elem,config)))
}

