/**
 * @module DEER Data Encoding and Exhibition for RERUM
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
                let id = mutation.target.getAttribute(DEER.ID)
                if (id === "null") return
                let obj = await fetch(id).then(response => response.json()).catch(error => error)
                new DeerReport(mutation.target, DEER)
                // TODO: This is too heavy. Create a "populateFormFields" method and call it instead.
                break
            case DEER.LISTENING:
                let listensTo = mutation.target.getAttribute(DEER.LISTENING)
                if (listensTo) {
                    mutation.target.addEventListener(DEER.EVENTS.CLICKED, e => {
                        let loadId = e.detail["@id"]
                        if (loadId === listensTo) { mutation.target.setAttribute("deer-id", loadId) }
                    })
                }
        }
    }
}

export default class DeerReport {
    constructor(elem, deer = {}) {


        for (let key in DEER) {
            if (typeof DEER[key] === "string") {
                DEER[key] = deer[key] || config[key]
            } else {
                DEER[key] = Object.assign(config[key], deer[key])
            }
        }
        this.$isDirty = false
        this.id = elem.getAttribute(DEER.ID)
        this.elem = elem
        this.evidence = elem.getAttribute(DEER.EVIDENCE) // inherited to inputs
        this.context = elem.getAttribute(DEER.CONTEXT) // inherited to inputs
        this.attribution = elem.getAttribute(DEER.ATTRIBUTION) // inherited to inputs
        this.motivation = elem.getAttribute(DEER.MOTIVATION) // inherited to inputs
        this.type = elem.getAttribute(DEER.TYPE)
        this.inputs = Array.from(elem.querySelectorAll(DEER.INPUTS.map(s => s + "[" + DEER.KEY + "]").join(",")))
        this.inputs.forEach(inpt => {
            inpt.addEventListener('input', (e) => {
                inpt.$isDirty = true //Make the input dirty
                this.$isDirty = true //Make the DeerReport dirty
            })
        })
        changeLoader.observe(elem, {
            attributes: true
        })
        elem.onsubmit = this.processRecord.bind(this)

        if (this.id) {
            //Do we want to expand for all types?
            UTILS.worker.postMessage({
                action: "form",
                id: this.id
            })
            UTILS.worker.addEventListener("message", event => {
                if (event.data.action === "expanded") {
                    let obj = event.data.item
                    try {
                        let inputElems = this.inputs
                        let flatKeys = [...new Set(inputElems.map(input => input.getAttribute(DEER.KEY)))]
                        let redundant = inputElems.length - flatKeys.size
                        if (redundant > 0) {
                            UTILS.warning(redundant + " duplicate input " + DEER.KEY + " attribute value" + redundant === 1 ? "" : "s" + " detected in form. Some inputs will be ignored upon form submission and only the first instance will be respected.", inputElems)
                        }
                        inputElems.map(elem => UTILS.assertElementValue(elem, obj))
                    } catch (err) { console.log(err) }
                    setTimeout(function () {
                        /*
                        *  The difference between a view and a form is that a view does not need to know the annotation data of its sibling views.  
                        *  A form needs to know the annotation data of all its child views to populate values, but this hierarchy is not inherent.
                        *  
                        *  This event works because of deerInitializer.js.  It loads all views in a Promise that uses a timeout
                        *  in its resolve state, giving all innerHTML = `something` calls time to make it to the DOM before this event broadcasts.  
                        *  You will notice that the "deer-view-rendered" events all happen before this event is fired on respective HTML pages.
                        *  This lets the script know forms are open for dynamic rendering interaction, like pre-filling or pre-selecting values.
                        */
                        UTILS.broadcast(undefined, DEER.EVENTS.FORM_RENDERED, elem, obj)
                    }, 0)
                    //Note this is deprecated for the "deer-form-rendered" event.
                    UTILS.broadcast(undefined, DEER.EVENTS.LOADED, elem, obj)
                }
                elem.click()
            })
        } else {
            this.inputs.forEach(inpt => {
                if (inpt.type === "hidden") { inpt.$isDirty = true }
            })
        }
    }

    processRecord(event) {
        event.preventDefault()
        this.evidence = this.elem.getAttribute(DEER.EVIDENCE) // inherited to inputs
        this.context = this.elem.getAttribute(DEER.CONTEXT) // inherited to inputs
        this.attribution = this.elem.getAttribute(DEER.ATTRIBUTION) // inherited to inputs
        this.motivation = this.elem.getAttribute(DEER.MOTIVATION) // inherited to inputs
        this.type = this.elem.getAttribute(DEER.TYPE)

        if (!this.$isDirty) {
            UTILS.warning(event.target.id + " form submitted unchanged.")
        }
        if (this.elem.getAttribute(DEER.ITEMTYPE) === "simple") {
            return this.simpleUpsert(event).then(entity => {
                //Notice that sipleUpsert may return {} in certain controlled situations, causing an undefined error here, on purpose.
                this.elem.setAttribute(DEER.ID, entity["@id"])
                new DeerReport(this.elem)
            })
        }
        let record = {
            "@type": this.type
        }
        if (this.context) { record["@context"] = this.context }
        for (let p of DEER.PRIMITIVES) {
            try {
                record[p] = this.elem.querySelector("[" + DEER.KEY + "='" + p + "']").value
            } catch (err) {
                UTILS.warning(err, null)
            }
        }
        let formAction
        if (this.id) {
            record["@id"] = this.id
            formAction = Promise.resolve(record)
        } else {
            let self = this
            formAction = fetch(DEER.URLS.CREATE, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify(record)
            })
                .then(response => response.json())
                .then(data => {
                    UTILS.broadcast(undefined, DEER.EVENTS.CREATED, self.elem, data.new_obj_state)
                    return data.new_obj_state
                })
                .catch(err => { })
        }

        formAction.then((function (entity) {
            let annotations = Array.from(this.elem.querySelectorAll(DEER.INPUTS.map(s => s + "[" + DEER.KEY + "]").join(","))).filter(el => Boolean(el.$isDirty))
            if (annotations.length === 0) {
                //May be worthwhile to call out the lack of descriptive information in this form submission.
            }
            let flatKeys = annotations.map(input => input.getAttribute(DEER.KEY))
            annotations = annotations.filter((el, i) => {
                //Throw a soft error if we detect duplicate deer-key entries, and only respect the first one.
                if (flatKeys.indexOf(el.getAttribute(DEER.KEY)) !== i) {
                    UTILS.warning("Duplicate input " + DEER.KEY + " attribute value '" + el.getAttribute(DEER.KEY) + "' detected during submission.  This input will be ignored.  See duplicate below. ", el)
                }
                return flatKeys.indexOf(el.getAttribute(DEER.KEY)) === i
            })
                .map(input => {
                    let inputId = input.getAttribute(DEER.SOURCE)
                    let creatorId = input.getAttribute(DEER.ATTRIBUTION) || this.attribution
                    let motivation = input.getAttribute(DEER.MOTIVATION) || this.motivation
                    let evidence = input.getAttribute(DEER.EVIDENCE) || this.evidence
                    let action = (inputId) ? "UPDATE" : "CREATE"
                    let annotation = {
                        type: "Annotation",
                        target: entity["@id"],
                        body: {}
                    }
                    if (creatorId) { annotation.creator = creatorId }
                    if (motivation) { annotation.motivation = motivation }
                    if (evidence) { annotation.evidence = evidence }
                    let delim = (input.hasAttribute(DEER.ARRAYDELIMETER)) ? input.getAttribute(DEER.ARRAYDELIMETER) : (DEER.DELIMETERDEFAULT) ? DEER.DELIMETERDEFAULT : ","
                    let val = input.value
                    let inputType = input.getAttribute(DEER.INPUTTYPE)
                    let arrKey = (input.hasAttribute(DEER.LIST)) ? input.getAttribute(DEER.LIST) : ""
                    if (input.hasAttribute(DEER.INPUTTYPE)) {
                        switch (inputType) {
                            case "List":
                            case "Set":
                            case "set":
                            case "list":
                            case "@set":
                            case "@list":
                                if (arrKey === "") {
                                    arrKey = "items"
                                    UTILS.warning("Found input with '" + DEER.INPUTTYPE + "' attribute but no '" + DEER.LIST + "' attribute during submission.  DEER will use the default schema '" + arrKey + "' to save the array values for this " + inputType + ".", input)
                                }
                                annotation.body[input.getAttribute(DEER.KEY)] = { "@type": inputType }
                                annotation.body[input.getAttribute(DEER.KEY)][arrKey] = val.split(delim)
                                break
                            case "ItemList":
                                if (arrKey === "") {
                                    arrKey = "itemListElement"
                                    UTILS.warning("Found input with '" + DEER.INPUTTYPE + "' attribute but no '" + DEER.LIST + "' attribute during submission.  DEER will use the default schema '" + arrKey + "' to save the array values for this " + inputType + ".", input)
                                }
                                annotation.body[input.getAttribute(DEER.KEY)] = { "@type": inputType }
                                annotation.body[input.getAttribute(DEER.KEY)][arrKey] = val.split(delim)
                                break
                            case "object":
                                let body = {
                                    profile: "http://www.w3.org/ns/anno.jsonld",
                                    value: val
                                }
                                try {
                                    body = JSON.parse(val)
                                } catch (err) { }
                                annotation.body[input.getAttribute(DEER.KEY)] = body
                                break
                            default:
                                UTILS.warning("Cannot save value of unsupported type '" + inputType + "'.  This annotation will not be saved or updated.", input)
                                return false
                        }
                    } else {
                        annotation.body[input.getAttribute(DEER.KEY)] = {
                            "value": val
                        }
                    }

                    if (inputId) { annotation["@id"] = inputId }
                    // TODO: maybe we need a deer-value to assign things here... or some option...
                    if (input.getAttribute(DEER.KEY) === "targetCollection") {
                        annotation.body.targetCollection = input.value
                    }
                    let name = input.getAttribute("title")
                    if (name) { annotation.body[input.getAttribute(DEER.KEY)].name = name }
                    return fetch(DEER.URLS[action], {
                        method: (inputId) ? "PUT" : "POST",
                        headers: {
                            "Content-Type": "application/json; charset=utf-8"
                        },
                        body: JSON.stringify(annotation)
                    })
                        .then(response => response.json())
                        .then(anno => {
                            input.setAttribute(DEER.SOURCE, anno.new_obj_state["@id"])
                            if (anno.new_obj_state.evidence) input.setAttribute(DEER.EVIDENCE, anno.new_obj_state.evidence)
                            if (anno.new_obj_state.motivation) input.setAttribute(DEER.MOTIVATION, anno.new_obj_state.motivation)
                            if (anno.new_obj_state.creator) input.setAttribute(DEER.ATTRIBUTION, anno.new_obj_state.creator)
                        })
                })
            return Promise.all(annotations).then(() => {
                UTILS.broadcast(undefined, DEER.EVENTS.UPDATED, this.elem, entity)
                return entity
            })
        }).bind(this))
            .then(entity => {
                this.elem.setAttribute(DEER.ID, entity["@id"])
                new DeerReport(this.elem)
            })
    }

    simpleUpsert(event) {
        let record = {}
        //Since this is simple, we don't need to filter around $isDirty.
        Array.from(this.elem.querySelectorAll(DEER.INPUTS.map(s => s + "[" + DEER.KEY + "]").join(","))).map(input => {
            let key = input.getAttribute(DEER.KEY)
            record[key] = {}
            let val = input.value
            let title = input.getAttribute("title")
            let evidence = input.getAttribute(DEER.EVIDENCE)
            if (title) record[key].name = title
            if (evidence) record[key].evidence = evidence
            let inputType = input.getAttribute(DEER.INPUTTYPE)
            let arrKey = (input.hasAttribute(DEER.LIST)) ? input.getAttribute(DEER.LIST) : ""
            let delim = (input.hasAttribute(DEER.ARRAYDELIMETER)) ? input.getAttribute(DEER.ARRAYDELIMETER) : (DEER.DELIMETERDEFAULT) ? DEER.DELIMETERDEFAULT : ","
            if (input.hasAttribute(DEER.INPUTTYPE)) {
                switch (inputType) {
                    case "List":
                    case "Set":
                    case "set":
                    case "list":
                    case "@set":
                    case "@list":
                        if (arrKey === "") {
                            arrKey = "items"
                            UTILS.warning("Found input with '" + DEER.INPUTTYPE + "' attribute but no '" + DEER.LIST + "' attribute during submission.  DEER will use the default schema '" + arrKey + "' to save the array values for this " + inputType + ".", input)
                        }
                        record[key]["@type"] = inputType
                        record[key][arrKey] = val.split(delim)
                        break
                    case "ItemList":
                        if (arrKey === "") {
                            arrKey = "itemListElement"
                            UTILS.warning("Found input with '" + DEER.INPUTTYPE + "' attribute but no '" + DEER.LIST + "' attribute during submission.  DEER will use the default schema '" + arrKey + "' to save the array values for this " + inputType + ".", input)
                        }
                        record[key] = { "@type": inputType }
                        record[key][arrKey] = val.split(delim)
                        break
                    case "object":
                        let body = {
                            profile: "http://www.w3.org/ns/anno.jsonld",
                            value: val
                        }
                        try {
                            body = JSON.parse(val)
                        } catch (err) { }
                        record[key] = body
                        break
                    default:
                        UTILS.warning("Cannot save value of unsupported type '" + inputType + "'.  This annotation will not be saved or updated.", input)
                        return false
                }
            } else {
                //Assuming that a simple object doesn't want the values of key:value pairs to be objects unless it has to, so we won't wrap like key:{value:{}}
                record[key] = val
            }
        })
        if (Object.keys(record).length === 0) {
            //There is no good reason for this, but DEER allows it.  However, there better a type otherwise it is completely undescribed.
            UTILS.warning("The form submitted does not contain any inputs. The resulting entity will not have any descriptive encoding.", this.elem)
            if (!this.type) {
                //DEER does not abide.  A completely undescribed object, even if we were to find evidence and context, is useless, especially in this 'simple' context. 
                UTILS.warning("Form submission should not result in a completely undescribed object.  At least a 'type' property must be present.  Please add information to submit this simple form.", this.elem)
                //Deny outright and send an empty object upstream (see processRecord).
                return {}
            }
        }
        if (this.type) { record.type = this.type }
        if (this.context) { record["@context"] = this.context }
        if (this.evidence) { record.evidence = this.evidence }
        let formId = this.elem.getAttribute(DEER.ID)
        let action = "CREATE"
        if (formId) {
            action = "OVERWRITE"
            record["@id"] = formId
        }
        return fetch(DEER.URLS[action], {
            method: (formId) ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(record)
        })
            .then(response => response.json())
            .then(obj => { return obj.new_obj_state })
    }
}

export function initializeDeerForms(config) {
    const forms = document.querySelectorAll(config.FORM)
    Array.from(forms).forEach(elem => new DeerReport(elem, config))
    document.addEventListener(DEER.EVENTS.NEW_FORM, e => Array.from(e.detail.set).forEach(elem => new DeerReport(elem, config)))
}
