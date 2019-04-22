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
    listFromCollection: function(collectionId){
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
            pointers.map(tc => list.push(fetch(tc.target).then(response=>response.json())))
            return Promise.all(list)
        })
        .then(function (list) {
            return list
        })
    },
    listFromContainer: function(){},
    getValue: function(property, alsoPeek = [], asType) {
        // TODO: There must be a best way to do this...
        let prop;
        if(property===undefined || property === ""){
            return "[Unknown]"
        }
        if (Array.isArray(property)) {
            prop = property.map(this.getValue.bind(this))
        }
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
        // JSON-LD says no nested arrays, but we know people.
        if (Array.isArray(prop)) {
            prop = prop.map(this.getValue.bind(this))
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
     /*
     @Deprecated?  
    get getLabel() {
        return (obj,noLabel="[ unlabeled ]",options={}) => {
            if(typeof obj === "string") { return obj }
            let label = obj[options.label]||obj.name||obj.label||obj.title
            return (label)?this.getValue(label):noLabel
        }
    },
    */
    /**
     * Attempt to discover a readable label from the object
     */
     getLabel: function(obj,noLabel="[ unlabeled ]",options={}) {
        if(typeof obj === "string") { return obj }
        let label = obj[options.label]||obj.name||obj.label||obj.title
        return (label)?this.getValue(label):noLabel
        
    },
    /**
     * Take a known object with an id and query for annotations targeting it.
     * Discovered annotations are attached to the original object and returned.
     * @param {Object} obj Target object to search for description
     */
    async expand(obj) {
        let findId = obj["@id"]
        if(!findId) return Promise.resolve(obj)
        let getValue = this.getValue
        // If an expand like {"@id":"idToExapnd"} where idToExpand has no annotations, {"@id":"idToExapnd"} is returned unresolved...
        // At minimum, this function should resolve the object to properly expand it unless we have a local copy that isn't dirty.
        //TODO catch a fetch failure?
        obj = await fetch(findId).then(response=>response.json())
        return this.findByTargetId(findId)
        // TODO: attach evidence to each property value
        // add each value in a predictable way
        // type properties for possible rendering?
        .then(function(annos){
            
            for (let i = 0; i < annos.length; i++) {
                let body
                let anno = annos[i]
                try {
                    body = anno.body
                } catch(err){ continue }
                if (!body) { continue }
                if (!Array.isArray(body)) {
                    body = [body]
                }
                //^^ FIXME what if it doesn't have anno.body?  What if it is anno.resource or anno.value?
                let annoLabel = anno.label ? anno.label : anno.title ? anno.title : anno.purpose ? anno.purpose : "untitledAnno"
                Leaf: for (let j = 0; j < body.length; j++) {
                    //expand() is not doing what I expect.  If it finds evidence here, it does not continuing building
                    // out the obj.  
                    if (body[j].evidence) {
                        obj.evidence = (typeof body[j].evidence === "object") ? body[j].evidence["@id"] : body[j].evidence
                    } 
                    //else {
                    try{
                        let valToAssign = {}
                        let discoveredBody
                        if(typeof body[j] === "object"){
                            //Then it is like {some:"data", value:"What we want"} hopefully
                            let alsoPeek = ["@value", "value", "$value", "val"]
                            let foundVal = false;
                            for (let k of alsoPeek) {
                                if (body[j].hasOwnProperty(k)) {
                                    foundVal = true;
                                    break
                                } 
                            }
                            if (foundVal){
                                discoveredBody = body[j]
                            }
                            else{
                                //I don't think we will be able to pull a value from this down the line...
                                discoveredBody = body[j]
                            }
                        }
                        else{
                            //Presumably it is a string which is the value we were looking for
                            discoveredBody = body[j]
                        }
                        
                        if (typeof discoveredBody === "string" || !discoveredBody.source) {
                            // include an origin for this property, placehold madsrdf:Source
                            let source = {
                                citationSource: annos[i]["@id"],
                                citationNote: annos[i].label || "Composed object from DEER",
                                comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/TinyThings"
                            }
                            if(typeof discoveredBody === "string"){
                                //Then the value we discovered is a string and we want it to be an object with value and source
                                valToAssign["value"] = discoveredBody
                                valToAssign["source"] = source

                            }
                            else{
                                //Then the value we discovered is already an object, we want it to have a source
                                discoveredBody["source"] = source
                                valToAssign = discoveredBody
                            }
                        }
                        if (annos[i].__rerum && annos[i].__rerum.history.next.length) {
                            // this is not the most recent available
                            // TODO: maybe check generator, etc.
                            continue Leaf
                        } 
                        else {
                            let assignObj = {}
                            //Now we can assign these annos targeting this object like objTargeted[annoLabel] = annoValueObject
                            assignObj[annoLabel] = valToAssign //Notice valToAssign is never a string even if the original value was.
                            obj = Object.assign(obj, assignObj)
                        }
                    } catch(err){}
                    //}
                }
            }
            return obj
        })
    },
    /**
     * Execute query for any annotations in RERUM which target the
     * id passed in. Promise resolves to an array of annotations.
     * @param {String} id URI for the targeted entity
     */
    findByTargetId: async function(id) {
        let everything = Object.keys(localStorage).map(k=>JSON.parse(localStorage.getItem(k)))
        let obj = {
            target: id
        }
        let matches = await fetch(DEER.URLS.QUERY, {
            method: "POST",
            body: JSON.stringify(obj),
            headers: {
                "Content-Type": "application/json"
            }
        })
        .then(response=>response.json())
        .catch((err)=>console.log(err))
        let local_matches = everything.filter(o => o.target === id)
        matches = local_matches.concat(matches)
        return matches
    },

    /**
     * An error handler for various HTTP traffic scenarios
     */
    handleHTTPError: function(response){
        if (!response.ok){
            let status = response.status
            switch(status){
                case 400:
                    console.log("Bad Request")
                break
                case 401:
                    console.log("Request was unauthorized")
                break
                case 403:
                    console.log("Forbidden to make request")
                break
                case 404:
                    console.log("Not found")
                break
                case 500:
                    console.log("Internal server error")
                break
                case 503:
                    console.log("Server down time")
                break
                default:
                    console.log("unahndled HTTP ERROR")
            }
            throw Error("HTTP Error: "+response.statusText)
        }
        return response
    },

    /**
     * Broadcast a message about DEER
     */
    broadcast: function(event={}, type, element, obj={}){
        let e = new CustomEvent(type, {detail: Object.assign(obj,{target:event.target}),bubbles:true})
        element.dispatchEvent(e)
    }
}