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
            //prop = property.map(this.getValue.bind(this))
            prop = property
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
        let findId = entity["@id"] || entity.id || entity
        if (typeof findId !== "string") {
            console.warn("Unable to find URI in object:",entity)
            return entity
        }
        let getVal = this.getValue
        return fetch(findId).then(response => response.json())
            .then(obj => this.findByTargetId(findId)
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
                                    if (obj[k] !== undefined && annos[i].__rerum && annos[i].__rerum.history.next.length) {
                                        // this is not the most recent available
                                        // TODO: maybe check generator, etc.
                                        continue Leaf;
                                    }
                                    else {
                                        // Assign this to the main object.
                                        if(obj[k]) {
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
                                            } else if (obj[k].name !== val.name) { // often undefined
                                                obj[k] = [obj[k],val]
                                            }
                                        } else {
                                            // or just tack it on
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
                    console.warn("Error expanding object:" + err)
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
        let matches = await fetch(DEER.URLS.QUERY, {
            method: "POST",
            body: JSON.stringify(obj),
            headers: {
                "Content-Type": "application/json"
            }
        })
            .then(response => response.json())
            .catch((err) => console.warn(err))
        let local_matches = everything.filter(o => o.target === id)
        matches = local_matches.concat(matches)
        return matches
    },

    /**
     * An error handler for various HTTP traffic scenarios
     */
    handleHTTPError: function (response) {
        if (!response.ok) {
            let status = response.status
            switch (status) {
                case 400:
                    console.warn("Bad Request")
                    break
                case 401:
                    console.warn("Request was unauthorized")
                    break
                case 403:
                    console.warn("Forbidden to make request")
                    break
                case 404:
                    console.warn("Not found")
                    break
                case 500:
                    console.warn("Internal server error")
                    break
                case 503:
                    console.warn("Server down time")
                    break
                default:
                    console.warn("unahndled HTTP ERROR")
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
     * Remove array values that are objects or arrays.  We have decided these are not meant to be populated
     * to interface.
    */
    cleanArray:function(arr){
        return arr.filter((arrItem)=>{
            if(Array.isArray(arrItem)){
                console.warn("An annotation body value array contained an array.  We ignored it.  See ignored value below.")
                console.warn(arrItem)
            }
            else if(typeof arrItem === "object") {
                //TODO how should we handle?
                console.warn("An annotation body value array contained an object.  We ignored it.  See ignored value below.")
                console.warn(arrItem)
            }
            return ["string","number"].indexOf(typeof arrItem)>-1
        })
    },

    /**
     * Get the array of data from the container object, so long at it is one of the containers we support (so we know where to look.) 
    */
    getArrayFromObj:function(containerObj){
        let cleanArray = []
        let objType = containerObj.type || containerObj["@type"] || ""
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
            if(["List", "Set", "set","list", "@set", "@list"].indexOf(objType) > -1){
                cleanArray = this.cleanArray(containerObj.items)
            }
            else if(["ItemList"].indexOf(objType > -1)){
                cleanArray = this.cleanArray(containerObj.itemListElement)
            }
        }
        else{
            console.warn("The type of object ("+objType+") is not a supported container type.  Therefore, the value will be empty.  Check the annotation body value.")
            console.warn(containerObj)
        }
        return cleanArray
    },

    /**
     * Given an array, turn the array into a string where the values are separated by the given delimeter.
    */
    stringifyArray:function(arr, delim){
        //TODO detect if delim is not the correct deliminator and warn?
        //TODO warn if arr is empty?
        if(delim === ","){
            //We are making a hard choice here and saying that for interface input areas, it is best if values are separated by a , plus " "
            delim += " "
        }
        try{
            return (arr.length) ? arr.join(delim) : ""    
        }
        catch (e){
            console.error("There was a join error on "+arr)
            return ""
        }
        
    },

    /**
     * Assert a value from an annotation onto an HTML input element.
     * If it is a hidden input, the set value matters to determine whether or not the element is dirty.
     * Note this should only be used for DEER inputs. 
    */
    assertElementValue:function(elem, val, delim){
        let re = new RegExp(", ", "g") //Replace all ', '...
        if(elem.value){
            if(elem.type==="hidden"){
                //Notice this will not consider hidden inputs with empty values in favor of avoiding accidental empty overwrites.
                //Also notice we are negating whitespace matching around the , plus " " delimeter situation
                if(elem.value.replace(re, ",") !== val.replace(re, ",")){
                    console.log("Found a hidden element that did not have a macthing value.  Making it dirty.")
                    console.log(elem.outerHTML)
                    elem.$isDirty = true  
                }
            } else{
                console.warn("Element value '"+elem.value+"' is not equal to the annotation value '"+val+"'.  The element value should not be set and is being overwritten.")
            }
        }
        elem.value = val
    }

}