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

import { default as DEER } from './deer-config.js'

export default {
    listFromCollection: function (collectionId) {
        let queryObj = {
            body: {
                targetCollection: collectionId
            }
        }
        return fetch(DEER.URLS.QUERY, {
            method: "POST",
            body: JSON.stringify(queryObj)
        }).then(response => response.json())
            .then(function (pointers) {
                let list = []
                pointers.map(tc => list.push(fetch(tc.target).then(response => response.json())))
                return Promise.all(list)
            })
            .then(function (list) {
                return list
            })
    },
    getValue: function (property, alsoPeek = [], asType) {
        // TODO: There must be a best way to do this...
        let prop;
        if (property === undefined || property === "") {
            console.error("Value of property to lookup is missing!")
            return undefined
        }
        if (Array.isArray(property)) {
            //It is an array of things, we can only presume that we want the array.  If it needs to become a string, local functions take on that responsibility.
            return property
        } else {
            if (typeof property === "object") {
                // TODO: JSON-LD insists on "@value", but this is simplified in a lot
                // of contexts. Reading that is ideal in the future.
                if (!Array.isArray(alsoPeek)) {
                    alsoPeek = [alsoPeek]
                }
                alsoPeek = alsoPeek.concat(["@value", "value", "$value", "val"])
                for (let k of alsoPeek) {
                    if (property.hasOwnProperty(k)) {
                        prop = property[k]
                        break
                    }
                    else {
                        prop = property
                    }
                }
            }
            else {
                prop = property
            }
        }
        try {
            switch (asType.toUpperCase()) {
                case "STRING":
                    prop = prop.toString();
                    break
                case "NUMBER":
                    prop = parseFloat(prop);
                    break
                case "INTEGER":
                    prop = parseInt(prop);
                    break
                case "BOOLEAN":
                    prop = !Boolean(["false", "no", "0", "", "undefined", "null"].indexOf(String(prop).toLowerCase().trim()));
                    break
                default:
            }
        } catch (err) {
            if (asType) {
                throw new Error("asType: '" + asType + "' is not possible.\n" + err.message)
            } else {
                // no casting requested
            }
        } finally {
            return (prop.length === 1) ? prop[0] : prop
        }
    },
    /**
     * Attempt to discover a readable label from the object
     */
    get getLabel() {
        return (obj, noLabel = "[ unlabeled ]", options = {}) => {
            if (typeof obj === "string") { return obj }
            let label = obj[options.label] || obj.name || obj.label || obj.title
            if(Array.isArray(label)) {
                label = [...new Set(label.map(l => this.getValue(this.getLabel(l))))]

            }
            return label || noLabel
        }
    },
    /**
     * Take a known object with an id and query for annotations targeting it.
     * Discovered annotations are attached to the original object and returned.
     * @param {Object} entity Target object to search for description
     */
    async expand(entity) {
        let UTILS = this
        let findId = entity["@id"] || entity.id || entity
        if (typeof findId !== "string") {
            UTILS.warning("Unable to find URI in object:",entity)
            return entity
        }
        let getVal = this.getValue
        return fetch(findId).then(response => response.json())
            .then(obj => UTILS.findByTargetId(findId)
                .then(function (annos) {
                    for (let i = 0; i < annos.length; i++) {
                        let body
                        try {
                            body = annos[i].body
                        } catch (err) { continue }
                        if (!body) { continue }
                        if (!Array.isArray(body)) {
                            body = [body]
                        }
                        Leaf: for (let j = 0; j < body.length; j++) {
                            if (body[j].evidence) {
                                obj.evidence = (typeof body[j].evidence === "object") ? body[j].evidence["@id"] : body[j].evidence;
                            }
                            else {
                                try {
                                    let val = body[j];
                                    let k = Object.keys(val)[0];
                                    if (!val.source) {
                                        // include an origin for this property, placehold madsrdf:Source
                                        let aVal = getVal(val[k])
                                        val[k] = {
                                            value: aVal,
                                            source: {
                                                citationSource: annos[i]["@id"],
                                                citationNote: annos[i].label || "Composed object from DEER",
                                                comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/TinyThings"
                                            }
                                        }
                                    }
                                    if (annos[i].hasOwnProperty("__rerum") && annos[i].__rerum.history.next.length) {
                                        // this is not the most recent available
                                        // TODO: maybe check generator, etc.
                                        continue Leaf;
                                    }
                                    else {
                                        // Assign this to the main object.
                                        if(obj.hasOwnProperty(k)) {
                                            // It may be already there as an Array with some various labels
                                            if (Array.isArray(obj[k])){
                                                let deepMatch = false
                                                for(const e of obj[k]) {
                                                    if(e.name===val.name){
                                                        deepMatch = true
                                                        break
                                                    }
                                                }
                                                if(!deepMatch) { obj[k].push(val) }
                                            } else{
                                                //It is already there and is an object, string, or number, perhaps from another annotation with a similar body.  
                                                //Add in the body of this annotation we found,  DEER will aribitrarily pick a value from the array down the road and preference Annotations.
                                                obj[k] = [obj[k],val]
                                            }
                                        } else {
                                            //or just tack it on
                                            obj = Object.assign(obj, val);
                                        }
                                    }
                                }
                                catch (err_1) { }
                            }
                        }
                    }
                    return obj
                })).catch(err => {
                    console.error("Error expanding object:" + err)
                    return err
                })
    },
    /**
     * Execute query for any annotations in RERUM which target the
     * id passed in. Promise resolves to an array of annotations.
     * @param {String} id URI for the targeted entity
     * @param [String] targetStyle other formats of resource targeting.  May be null
     */
    findByTargetId: async function (id, targetStyle=[]) {
        let everything = Object.keys(localStorage).map(k => JSON.parse(localStorage.getItem(k)))
        if (!Array.isArray(targetStyle)) {
            targetStyle = [targetStyle]
        }
        targetStyle = targetStyle.concat(["target", "target.@id", "target.id"]) //target.source?
        let obj = {"$or":[]}
        for (let target of targetStyle) {
            //Entries that are not strings are not supported.  Ignore those entries.  
            //TODO: should we we let the user know we had to ignore something here?
            if(typeof target === "string"){
                let o = {}
                o[target] = id
                obj["$or"].push(o)
            }
        }
        //TODO let this request also include $and:__rerum.history.next.length === 0
        let matches = await fetch(DEER.URLS.QUERY, {
            method: "POST",
            body: JSON.stringify(obj),
            headers: {
                "Content-Type": "application/json"
            }
        })
            .then(response => response.json())
            .catch((err) => console.error(err))
        let local_matches = everything.filter(o => o.target === id)
        matches = local_matches.concat(matches)
        return matches
    },

    /**
     * An error handler for various HTTP traffic scenarios
     */
    handleHTTPError: function (response) {
        let UTILS = this
        if (!response.ok) {
            let status = response.status
            switch (status) {
                case 400:
                    UTILS.warning("Bad Request")
                    break
                case 401:
                    UTILS.warning("Request was unauthorized")
                    break
                case 403:
                    UTILS.warning("Forbidden to make request")
                    break
                case 404:
                    UTILS.warning("Not found")
                    break
                case 500:
                    UTILS.warning("Internal server error")
                    break
                case 503:
                    UTILS.warning("Server down time")
                    break
                default:
                    UTILS.warning("unahndled HTTP ERROR")
            }
            throw Error("HTTP Error: " + response.statusText)
        }
        return response
    },

    /**
     * Broadcast a message about DEER
     */
    broadcast: function (event = {}, type, element, obj = {}) {
        let e = new CustomEvent(type, { detail: Object.assign(obj, { target: event.target }), bubbles: true })
        element.dispatchEvent(e)
    },

    /**
     * Remove array values that are objects or arrays.  We have decided these are not meant to be put to the interface.
    */
    cleanArray:function(arr){
        let UTILS = this
        return arr.filter((arrItem)=>{
            if(Array.isArray(arrItem)){
                UTILS.warning("An annotation body value array contained an array.  We ignored it.  See ignored value below.")
                UTILS.warning(arrItem)
            } else if(typeof arrItem === "object") {
                //TODO how should we handle?
                UTILS.warning("An annotation body value array contained an object.  We ignored it.  See ignored value below.")
                UTILS.warning(arrItem)
            }
            return ["string","number"].indexOf(typeof arrItem)>-1
        })
    },

    /**
     * Get the array of data from the container object, so long at it is one of the containers we support (so we know where to look.) 
    */
    getArrayFromObj:function(containerObj, inputElem){
        let cleanArray = []
        let objType = containerObj.type || containerObj["@type"] || ""
        let UTILS = this
        let arrKey = (inputElem.hasAttribute(DEER.LIST)) ? inputElem.getAttribute(DEER.LIST) : ""
        if(Array.isArray(objType)){
            //Since type can be an array we have to pick one of the values that matches one of our supported container types.
            //This picks the first one it comes across, since it doesnt seem like we would have any preference.
            for(let t of objType){
                if(DEER.CONTAINERS.indexOf(t) > -1){
                    objType = t
                    break
                }
            }
        }
        if(DEER.CONTAINERS.indexOf(objType) > -1){
            //Where it is we will find the array we seek differs between our supported types.  Perhaps we should store that with them in the config too.
            if(["Set", "List", "set","list", "@set", "@list"].indexOf(objType) > -1){
                if(arrKey === "") {
                    arrKey = "items"
                    UTILS.warning("Found attribute '"+DEER.ARRAYTYPE+"' on an input, but there is no '"+DEER.LIST+"' attribute value.  DEER will use the default schema '"+arrKey+"' to find the array values for this "+objType+".", inputElem)
                } 
                if(containerObj.hasOwnProperty(arrKey)){ cleanArray = this.cleanArray(containerObj[arrKey]) }
                else{ 
                    console.error("Object of type ("+objType+") is malformed.  The values could not be found in obj["+arrKey+"].  Therefore, the value is empty.  See object below.") 
                    console.log(containerObj)
                }
            } else if(["ItemList"].indexOf(objType > -1)){
                if(arrKey === "") {
                    arrKey = "itemListElement"
                    UTILS.warning("Found attribute '"+DEER.ARRAYTYPE+"' on an input, but there is no '"+DEER.LIST+"' attribute value.  DEER will use the default schema '"+arrKey+"' to find the the array values for this "+objType+".", inputElem)
                } 
                if(containerObj.hasOwnProperty(arrKey)){ cleanArray = this.cleanArray(containerObj[arrKey])}
                else{
                    console.error("Object of type ("+objType+") is malformed.  The values could not be found in obj["+arrKey+"].  Therefore, the value is empty.  See object below.")
                    console.log(containerObj)
                }
            }
        } else{
            console.error("Object of type ("+objType+") is not a supported container type.  Therefore, the value will be empty.  See object below..")
            console.log(containerObj)
        }
        return cleanArray
    },

    /**
     * Given an array, turn the array into a string where the values are separated by the given delimeter.
    */
    stringifyArray:function(arr, delim){
        //TODO warn if arr is empty?
        try{
            return (arr.length) ? arr.join(delim) : ""    
        }
        catch (e){
            console.error("There was a join error on '"+arr+"'' using delimeter '"+delim+"'.")
            return ""
        }
    },

    /**
     * Assert a value found on an expanded object onto the HTML input that represents it.
     * The input is a representative for the annotation so the values should match.  Hidden elements will never have user interaction, they
     * must be marked dirty if the values do not match or if there is no annotation mapped to its DEER.KEY attribute.
     * Values should not be hard coded into non-hidden input fields, they will be overwritten by the annotation value without being marked dirty.

     * @param elem The input HTML element the value is being asserted on
     * @param val The string value to be asserted onto an input HTML element
     * @param fromAnno Boolean for if the value is from a DEER annotation as opposed to part of the object (noted in deer-id on the form) directly.
     * 
    */
    assertElementValue:function(elem, val, mapsToAnno){
        let UTILS = this
        if(elem.type==="hidden"){
            if(elem.hasAttribute("value") && elem.value !== undefined){
                if(!mapsToAnno || elem.value !== val){
                    elem.$isDirty = true  
                    if(elem.value !== val && elem.hasAttribute(DEER.ARRAYTYPE)){
                        UTILS.warning("Hidden element with a hard coded 'value' also contains attributes '"+DEER.KEY+"' and '"+DEER.ARRAYTYPE+"'.  "
                        + "DEER takes this to mean the '"+elem.getAttribute(DEER.KEY)+"' annotation body value array will .join() into this string and pass a comparison operation. " 
                        + "If the array value as string does not match the hidden element's value string (including empty string), it will be considered dirty and a candidate "
                        + "to be updated upon submission even though no interaction has taken place to change it.  Make sure this is what you want. \n"
                        + "If this hidden input value is reactive to other interactions then processing should be done by your own custom interaction handler. "
                        + "Remove the hard coded '"+DEER.KEY+"' or 'value' attribute.  This will make the DEER form input handler avoid processing of this input on page load. "
                        + "If you want form submission to handle the annotation behind the input, make sure to handle the $isDirty state appropriately and restore the '"+DEER.KEY+"' attribute before submission. " 
                        + "See below.", elem)
                    }
                    
                }
            }
        } else{
            if(elem.hasAttribute("value") && elem.value !== undefined){
                //Empty strings count as a value.
                UTILS.warning("Element value is already set.  The element value should not be hard coded and will be overwritten by the annotation value '"+val+"'.  See below.", elem)
            }
            if(elem.hasAttribute(DEER.ARRAYTYPE)){
                UTILS.warning("This input element also has attribute '"+DEER.ARRAYTYPE+"'.  This attribute is only for hidden inputs only.  The attribute is being removed to avoid errors.")
                elem.removeAttribute(DEER.ARRAYTYPE)
            }
            elem.value = val
            elem.setAttribute("value", val)
        }
    },

    /**
      * Send a warning message to the console if dev has this feature turned on through the ROBUSTFEEDBACK config option.
    */
    warning:function(msg, logMe){
        if(DEER.ROBUSTFEEDBACK.valueOf() && msg){
            console.warn(msg)
            if(logMe){
                console.log(logMe)
            }
        }
    }

}
