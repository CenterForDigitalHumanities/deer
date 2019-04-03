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

const observables = document.querySelectorAll(DEER.FORM)
Array.from(observables).forEach(elem=>new DeerReport(elem))

export default class DeerReport {
    constructor(elem,deer=DEER) {
        this.$dirty = false
        this.id = elem.getAttribute(DEER.ID)
        this.elem = elem
        this.evidence = elem.getAttribute(DEER.EVIDENCE) // inherited to inputs
        this.context = elem.getAttribute(DEER.CONTEXT) // inherited to inputs
        this.type = elem.getAttribute(DEER.TYPE)
        this.inputs = document.querySelectorAll(DEER.INPUTS)

        elem.onsubmit = this.processRecord

        // TODO: preload the values in the keys and add observer for @id changes
    }
    
    processRecord(event) {
        event.preventDefault()      
        let record = {
            "@context": this.context,
            "@type": this.type
        }
        try {
            record.name = this.elem.querySelectorAll(DEER.ENTITYNAME)[0].value
        } catch(err){}
        let action = "CREATE"
        if (this.id) {
            record["@id"] = this.id
            action = "UPDATE"
        }
        fetch(DEER.URLS[action], {
            method: (this.id) ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(record)
        })
        .then(response => response.json())
        .then(function(response) {
            let entity = response.new_obj_state
            let annotations = Array.from(this.inputs).map(input => {
                let inputId = input.getAttribute(DEER.SOURCE)
                let action = (inputId) ? "UPDATE" : "CREATE"
                let annotation = {
                    creator: DEER.ATTRIBUTION,
                    target: entity["@id"],
                    body: {}
                }
                if(inputId) { annotation["@id"] = inputId }
                annotation.body[input.getAttribute(DEER.KEY)] = {
                    value: input.value
                }
                let ev = input.getAttribute(DEER.EVIDENCE) || this.evidence
                if(ev) { annotation.body[input.getAttribute(DEER.KEY)].evidence = ev }
                let name = input.getAttribute("title")
                if(name) { annotation.body[input.getAttribute(DEER.KEY)].name = name }
                fetch(DEER.URLS[action], {
                    method: (inputId) ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8"
                    },
                    body: JSON.stringify(annotation)
                })
                .then(response=>response.json())
                .then(anno=>input.setAttribute(DEER.SOURCE,anno.new_obj_state["@id"]))
            })
            return Promise.all(annotations).then(()=>entity)
        })
        .then(entity => {
            this.elem.setAttribute(DEER.ID,entity["@id"])
            UTILS.broadcast(undefined,DEER.EVENTS[action+"D"],this.elem,entity)
        })
    }
}


/**
 * Generate a new object URI for a resource. Abstract additional
 * properties to annotations.
 * @param {Object} obj complete resource to process
 * @param {Object} attribution creator and generator identities
 */
async create(obj, attribution, evidence) {
    let mint = {
        "@context": obj["@context"] || this.default.context,
        "@type": obj["@type"] || this.default.type,
        "name": this.getValue(obj.name || obj.label) || this.default.name,
        "creator": attribution || this.default.creator
    }
    if (evidence) {
        mint.evidence = evidence
    }
    const newObj = await fetch(CREATE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(mint)
        })
        .then(this.handleHTTPError)
        .then(response => response.json())
    const listID = localStorage.getItem("CURRENT_LIST_ID") || this.DEFAULT_LIST_ID
    let list = await get(listID)
    const objID = newObj.new_obj_state["@id"]
    list.resources.push({
        "@id": objID,
        "label": newObj.new_obj_state.name
    })
    try {
        list = await fetch(UPDATE_URL, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify(list)
            })
            .then(this.handleHTTPError)
            .then(response => response.json().new_obj_state)
            .catch(err => Promise.reject(err))
    } catch (err) {}
    localStorage.setItem(list["@id"], JSON.stringify(list))
    localStorage.setItem("CURRENT_LIST_ID", list["@id"])
    let annotations = []
    for (var key of Object.keys(obj)) {
        if (["@context", "@type", "name"].indexOf(key) > -1) {
            continue
        }
        let annotation = {
            "@context": "",
            "@type": "Annotation",
            "motivation": "describing",
            "target": objID,
            "body": {}
        }
        annotation.body[key] = obj[key]
        if (attribution) {
            annotation.creator = attribution
        }
        if (evidence) {
            annotation.evidence = evidence
        }
        annotations.push(annotation)
    }
    // just enforcing the delay
    let temp = await Promise.all(annotations.map(upsert))
    return newObj.new_obj_state
}
