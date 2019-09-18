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
            new DeerReport(mutation.target,DEER)
            // TODO: This is too heavy. Create a "populateFormFields" method and call it instead.
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

export default class DeerReport {
    constructor(elem,deer={}) {
        for(let key in DEER) {
            if(typeof DEER[key] === "string") {
                DEER[key] = deer[key] || config[key]
            } else {
                DEER[key] = Object.assign(config[key],deer[key])
            }
        }
        this.$isDirty = false
        this.id = elem.getAttribute(DEER.ID)
        this.elem = elem
        this.evidence = elem.getAttribute(DEER.EVIDENCE) // inherited to inputs
        this.context = elem.getAttribute(DEER.CONTEXT) // inherited to inputs
        this.type = elem.getAttribute(DEER.TYPE)
        this.inputs = elem.querySelectorAll(DEER.INPUTS.map(s=>s+"["+DEER.KEY+"]").join(","))
        changeLoader.observe(elem, {
            attributes:true
        })
        elem.oninput = event => this.$isDirty = true
        elem.onsubmit = this.processRecord.bind(this)
        
        if (this.id) {
            //Do we want to expand for all types?
            UTILS.expand({"@id":this.id})
            .then((function(obj){
                try {
                    let inputElems = Array.from(this.inputs)
                    let flatKeys = inputElems.map(input => {
                        return input.getAttribute(DEER.KEY)
                    })
                    for(let i=0; i<inputElems.length; i++){
                        let el = inputElems[i]
                        let deerKeyValue = (el.hasAttribute(DEER.KEY)) ? el.getAttribute(DEER.KEY) : ""
                        let mapsToAnno = false
                        if(deerKeyValue){
                            //Then this is a DEER form input.
                            el.addEventListener('input', (e) => e.target.$isDirty = true)
                            let assertedValue = ""
                            if(flatKeys.indexOf(deerKeyValue)!==i){
                                UTILS.warning("Duplicate input "+DEER.KEY+" attribute value '"+deerKeyValue+"' detected in form.  This input will be ignored upon form submission and only the first instance will be respected.  See duplicate below.", el)
                                el.setAttribute(DEER.KEYDUPLICATE, "true")
                                //Don't skip the input though, let it recieve all warnings and errors per usual in case this happens to be the one the dev means to keep.
                            }
                            if(obj.hasOwnProperty(deerKeyValue)){
                                //Then there is a key on this object that maps to the input.  
                                //It is either an annotation or was part of the object directly.  If it has a 'source' property, we assume it is an annotation.
                                assertedValue = UTILS.getValue(obj[deerKeyValue])
                                mapsToAnno = (typeof obj[deerKeyValue] === "object" && obj[deerKeyValue].hasOwnProperty("source"))
                                if(mapsToAnno) {
                                    el.setAttribute(DEER.SOURCE,UTILS.getValue(obj[deerKeyValue].source,"citationSource"))
                                }
                                let annoBodyObjectType = (typeof assertedValue === "object") ? assertedValue.type || assertedValue["@type"] || "" : "" 
                                let delim = el.getAttribute(DEER.ARRAYDELIMETER) || DEER.DELIMETERDEFAULT || ","
                                let arrayOfValues = []
                                if(Array.isArray(assertedValue)){
                                    /**
                                      * This could mean multiple annotations of similar bodies exist so UTILS.expand() put them together.
                                      * This could mean that the key on the orignal object also had annotations existing for it so UTILS.expand() put them together.
                                      * This could mean that the key on the original object was an array already, and may not contain anything we can get a value from.
                                      * We will preference the first entry of the array that is an annotation.  
                                      * If no annotations are found, DEER will aribitrarily pick the last string or number encountered.   
                                      * DEER does not technically support this situation, but can make a best guess and help it along...
                                    */
                                    UTILS.warning("There are multiple possible values for key '"+deerKeyValue+"'. See below. ", assertedValue)
                                    let arbitraryAssertedValue = ""
                                    for(let entry of assertedValue){
                                        if(["string","number"].indexOf(typeof entry)>-1){
                                            //We found it and understand it, but we preference annotation objects so look at the rest of the entries.
                                            //Consequently, if no annotations are found, the last string/number entry will be the one DEER uses.
                                            mapsToAnno = false
                                            assertedValue = arbitraryAssertedValue = UTILS.getValue(entry)
                                        }
                                        else if(typeof entry === "object"){
                                            if(entry.hasOwnProperty(deerKeyValue) && entry[deerKeyValue].hasOwnProperty("source")){
                                                //Then this is an object like {deerKeyValue:{value:"hopefully", source:"anno/123"}} and can be preferenced
                                                mapsToAnno = true
                                                assertedValue = arbitraryAssertedValue = UTILS.getValue(entry[deerKeyValue])
                                                break
                                            } else if(entry.hasOwnProperty("source")){
                                                //Then this is an object like {value:"hopefully", source:"anno/123"} and can be preferenced
                                                mapsToAnno = true
                                                assertedValue = arbitraryAssertedValue = UTILS.getValue(entry)
                                                break
                                            }
                                        }
                                    }
                                    if(arbitraryAssertedValue){  UTILS.warning("DEER arbitrarily chose the value '"+arbitraryAssertedValue+"'.") }
                                    else{ 
                                        console.error("DEER did not understand any of these values.  Therefore, the value will be an empty string.") 
                                        assertedValue = ""
                                    }
                                } else if(typeof assertedValue === "object"){
                                    //getValue either returned an object because it could not find obj.value or because obj.value was an object.  
                                    if(mapsToAnno){
                                        //Then getValue found an annotation DEER understood and the body.value was an object.
                                        if(el.getAttribute(DEER.ARRAYTYPE)){
                                            //Only an element noted as a DEER.ARRAYTYPE would have this kind of annotation behind it.  For others, it is an error.  
                                            if(annoBodyObjectType === "" || el.getAttribute(DEER.ARRAYTYPE) !== annoBodyObjectType){
                                                //The HTML input should note the same type of container as the annotation so helper functiions can determine if it is a supported in DEER.CONTAINERS
                                                UTILS.warning("Container type mismatch!.  See attribute '"+DEER.ARRAYTYPE+"' on element "+el.outerHTML+"."
                                                    +" The element is now dirty and will overwrite the type noted in the annotation seen below upon form submission."
                                                    +" If the type of the annotation body is not a supported type then DEER will not be able to get the array of values.", obj[deerKeyValue])
                                            }
                                            arrayOfValues = UTILS.getArrayFromObj(assertedValue)
                                            assertedValue = UTILS.stringifyArray(arrayOfValues, delim)
                                        } else{
                                            //This should have been a string or number.  We do not support whatever was meant to be here.  
                                            console.error("We do not support annotation body values that are objects, unless they are a supported container object and the element "+el.outerHTML+" notes '"+DEER.ARRAYTYPE+"'.  Therefore, the value of annotation is being ignored.  See annotation below.")
                                            console.log(obj[deerKeyValue])
                                            assertedValue = ""
                                        } 
                                    } else{
                                        //Then getValue returned an object and could not confirm it was an annotation.  We cannot find a value. 
                                        console.error("Could not find 'value' in the object body.  See below.")
                                        console.log(obj[deerKeyValue])
                                        assertedValue = ""
                                    } 
                                } else if((["string","number"].indexOf(typeof assertedValue)>-1)){
                                    //getValue either found that obj[deerKeyValue] was a string or found that it was an object with a 'value' that was a string or number. 
                                    //The asserted value is already set and we know whether or not it mapsToAnno, so do nothing.  Keep this here for future handling. 
                                } else{
                                    //An undefined situation perhaps?
                                    console.error("We do not support values of this type '"+typeof assertedValue+"'.  Therefore, the value of annotation is being ignored.  See annotation below.")
                                    console.log(obj[deerKeyValue])
                                    assertedValue = ""
                                }
                            }
                            UTILS.assertElementValue(el, assertedValue, mapsToAnno)
                        }
                    }
                } catch(err){ console.log(err) }
                UTILS.broadcast(undefined,DEER.EVENTS.LOADED,elem,obj)
            }).bind(this))
            .then(()=>elem.click())
        } else {
            Array.from(this.inputs).filter(el=>el.type==="hidden").forEach(inpt=>inpt.$isDirty = true)
        }
    }
    
    processRecord(event) {
        event.preventDefault()  
        if (!this.$isDirty) {
            UTILS.warning(event.target.id+" form submitted unchanged.")
        }
        if(this.elem.getAttribute(DEER.ITEMTYPE)==="simple") {
            return this.simpleUpsert(event).bind(this).then(entity => {
                this.elem.setAttribute(DEER.ID,entity["@id"])
                new DeerReport(this.elem)
            })
        }
        let record = {
            "@type": this.type
        }
        if(this.context) { record["@context"] = this.context }
        try {
            record.name = this.elem.querySelectorAll(DEER.ENTITYNAME)[0].value
        } catch(err){}
        let formAction
        if (this.id) {
            record["@id"] = this.id
            formAction = Promise.resolve(record)
        } else {
            formAction = fetch(DEER.URLS.CREATE, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                },
                body: JSON.stringify(record)
            })
            .then(response => response.json())
            .then(data => data.new_obj_state)
            UTILS.broadcast(undefined,DEER.EVENTS.CREATED,this.elem,record)
        }

        formAction.then((function(entity) {
            let annotations = Array.from(this.elem.querySelectorAll(DEER.INPUTS.map(s=>s+"["+DEER.KEY+"]").join(",")))
            .filter(el=>Boolean(el.$isDirty))
            annotations.filter(el=>{
                //Throw a soft error if we detect duplicate deer-key entries, and only respect the first one.
                if(el.hasAttribute(DEER.KEYDUPLICATE)){
                    UTILS.warning("Duplicate input "+DEER.KEY+" attribute value '"+el.hasAttribute(DEER.KEY)+"' detected during submission.  This input will be ignored.  See duplicate below. ", el)
                }
                return !el.hasAttribute(DEER.KEYDUPLICATE)
            })
            .map(input => {
                let inputId = input.getAttribute(DEER.SOURCE)
                let action = (inputId) ? "UPDATE" : "CREATE"
                let annotation = {
                    type: "Annotation",
                    creator: DEER.ATTRIBUTION,
                    target: entity["@id"],
                    body: {}
                }
                let delim = input.getAttribute(DEER.ARRAYDELIMETER) || DEER.DELIMETERDEFAULT || ","
                let val = input.value
                let arrType = input.getAttribute(DEER.ARRAYTYPE)
                if(input.hasAttribute(DEER.ARRAYTYPE)){
                    if(DEER.CONTAINERS.indexOf(arrType) > -1){
                        //TODO warn user if delim is not detected in val?
                        val = (val !== "") ? val.split(delim) : []
                        if(["List", "Set", "set","list", "@set", "@list"].indexOf(arrType) > -1){
                            annotation.body[input.getAttribute(DEER.KEY)] = {
                                "@type":arrType,
                                "items":val
                            }
                        } else if(["ItemList"].indexOf(arrType > -1)){
                            annotation.body[input.getAttribute(DEER.KEY)] = {
                                "@type":arrType,
                                "itemListElement":val
                            }
                        }
                    } else{
                        console.error("Cannot save array value of unsupported type "+arrType+".  This annotation will not be saved or updated.")
                        return false
                        // Could save it as a string instead of failing...
                        // annotation.body[input.getAttribute(DEER.KEY)] = {
                        //     "value":input.value
                        // }
                    }
                } else{
                    annotation.body[input.getAttribute(DEER.KEY)] = {
                        "value":val
                    }
                }  
            
                if(inputId) { annotation["@id"] = inputId }
                // TODO: maybe we need a deer-value to assign things here... or some option...
                if(input.getAttribute(DEER.KEY)==="targetCollection"){
                    annotation.body.targetCollection = input.value
                }
                let ev = input.getAttribute(DEER.EVIDENCE) || this.evidence
                if(ev) { annotation.body[input.getAttribute(DEER.KEY)].evidence = ev }
                let name = input.getAttribute("title")
                if(name) { annotation.body[input.getAttribute(DEER.KEY)].name = name }
                return fetch(DEER.URLS[action], {
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
        }).bind(this))
        .then(entity => {
            this.elem.setAttribute(DEER.ID,entity["@id"])
            new DeerReport(this.elem)
        })
    }

    simpleUpsert(event) {
        let record = {
            "@type": this.type
        }
        if(this.context) { record["@context"] = this.context }
        if(this.evidence) { record.evidence = this.evidence }
        try {
            record.name = this.elem.querySelectorAll(DEER.ENTITYNAME)[0].value
        } catch(err){}
        Array.from(this.elem.querySelectorAll(DEER.INPUTS.map(s=>s+"["+DEER.KEY+"]").join(","))).map(input => {
            let key = input.getAttribute(DEER.KEY)
            let val = input.value
            let title = input.getAttribute("title")
            let evidence = input.getAttribute(DEER.EVIDENCE)

            if(title || evidence) {
                val = { "@value" : val }
                if(title) val.name = title
                if(evidence) val.evidence = evidence
            }

            record[key] = (record.hasOwnProperty(key)) 
                ? ((Array.isArray(record[key])) ? record[key].push(val) : [record[key], val])
                : val

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
            .then(response=>response.json())
            .then(obj=>input.setAttribute(DEER.ID,obj.new_obj_state["@id"]))
        })
    }
}

/**
 * Generate a new object URI for a resource. Abstract additional
 * properties to annotations.
 * @param {Object} obj complete resource to process
 * @param {Object} attribution creator and generator identities
 */
async function create(obj, attribution, evidence) {
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

export function initializeDeerForms(config) {
    const forms = document.querySelectorAll(config.FORM)
    const formArray = Array.from(forms)
    Array.from(forms).forEach(elem => new DeerReport(elem,config))
    document.addEventListener(DEER.EVENTS.NEW_FORM,e => Array.from(e.detail.set).forEach(elem=>new DeerReport(elem,config)))
}
