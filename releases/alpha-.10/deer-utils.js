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
            // It is an array of things, we can only presume that we want the array.  If it needs to become a string, local functions take on that responsibility.
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
                    } else {
                        prop = property
                    }
                }
            } else {
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
        let UTILS = this
        return (obj, noLabel = "[ unlabeled ]", options = {}) => {
            if (typeof obj === "string") { return obj }
            let label = obj[options.label] || obj.name || obj.label || obj.title
            if (Array.isArray(label)) {
                label = [...new Set(label.map(l => this.getValue(l)))]
            }
            if (typeof label === "object") {
                label = UTILS.getValue(label)
            }
            return label || noLabel
        }
    },
    /**
     * Take a known object with an id and query for annotations targeting it.
     * Discovered annotations are asserted on the original object and returned.
     * @param {Object} entity Target object to search for description
     */
    async expand(entity, matchOn = ["__rerum.generatedBy", "creator"]) {
        let UTILS = this
        let findId = entity["@id"] || entity.id || entity
        if (typeof findId !== "string") {
            UTILS.warning("Unable to find URI in object:", entity)
            return entity
        }
        let getVal = UTILS.getValue
        return fetch(findId).then(response => response.json())
            .then(obj => UTILS.findByTargetId(findId)
                .then(function (annos) {
                    for (let i = 0; i < annos.length; i++) {
                        let body
                        try {
                            body = annos[i].body
                        } catch (err) { continue }
                        if (!body) { continue }
                        if (body.evidence) {
                            obj.evidence = (typeof body.evidence === "object") ? body.evidence["@id"] : body.evidence;
                        }
                        if (!Array.isArray(body)) {
                            body = [body]
                        }
                        Leaf: for (let j = 0; j < body.length; j++) {
                            try {
                                if (!checkMatch(obj, annos[i], matchOn)) {
                                    // this is not recognized as an annotation of interest by the interface
                                    continue Leaf
                                }
                                if (annos[i].hasOwnProperty("__rerum") && annos[i].__rerum.history.next.length) {
                                    // this may not be the most recent available
                                    // TODO: this is incorrect. There could be an unrelated @id in the .next and isUpdatedBy() will never fire
                                    continue Leaf;
                                }
                                let assertion = body[j]
                                let keys = Object.keys(assertion)
                                let k = keys[0]
                                if (keys.length > 1 || k === 0) {
                                    console.warn("This assertion is not as expected and may not have been interpreted correctly.", assertion)
                                }
                                let val = assertion[k]
                                val = buildValueObject(val, annos[i])
                                // Assign this to the main object.
                                if (obj.hasOwnProperty(k)) {
                                    // It may be already there as an Array with some various labels
                                    if (typeof obj[k] === "string") {
                                        // This is probably a primitive and may be updated/replaced.
                                        console.log('Updating primitive value "' + obj[k] + '" with annotation.', annos[i])
                                        obj[k] = buildValueObject(val, annos[i])
                                    } else if (Array.isArray(obj[k])) {
                                        if (isUpdatedBy(obj[k].source.citationSource, annos[i])) {
                                            const annoValues = (Array.isArray(val)) ? val : [val]
                                            annoValues.forEach(a => {
                                                // TODO: This is a brute force and not great.
                                                for (const v of obj[k]) {
                                                    try {
                                                        if (isUpdatedBy(v.source.citationSource), a) {
                                                            v = a
                                                        }
                                                    } catch (err) {
                                                        console.warn("I think a primitive got buried in here, but I'm moving on.")
                                                    }
                                                }
                                            })
                                        } else {
                                            obj[k].push(buildValueObject(val, annos[i]))
                                        }
                                    } else {
                                        if (isUpdatedBy(obj[k].source.citationSource, annos[i])) {
                                            // update value without creating an array
                                            obj[k] = buildValueObject(val, annos[i])
                                        } else {
                                            // Serialize both existing and new value as an Array
                                            obj[k] = [obj[k], buildValueObject(val, annos[i])]
                                        }
                                    }
                                } else {
                                    // or just tack it on
                                    obj[k] = buildValueObject(val, annos[i])
                                }
                            } catch (err_1) { }
                        }
                    }
                    return obj
                })).catch(err => {
                    console.error("Error expanding object:" + err)
                    return err
                })
        /**
         * Test if the metadata states that the second is an update to the first.
         * @param String assertion URI of the existing source of the assertion
         * @param Object anno the complete object of the new assertion
         * @returns Boolean if the first is updated by the second
         */
        function isUpdatedBy(assertionID, anno) {
            if (anno.__rerum.history.next.includes(assertionID)) {
                console.warn("You may be looking for updates backwards.", anno, assertionID)
            }
            return anno.__rerum.history.previous === assertionID
        }
        /**
         * Match on criteria(if exists) and return true if it appears to match on the values specified.
         * A true result means that the incoming assertion is likely to be relevant and authorized to 
         * augment the original object.
         * TODO: consider moving this up in scope, if useful
         * @param Object o existing Object with values to check.
         * @param Object a asserting Annotation to compare.
         * @param Array<String> matchOn dot-separated property paths on the two Objects to compare.
         * @returns Boolean if annotation should be considered a replacement for the current value.
         **/
        function checkMatch(expanding, asserting, matchOn) {
            let match = false
            CheckMatch: for (const m of matchOn) {
                let obj_match = m.split('.').reduce((o, i) => o[i], expanding)
                let anno_match = m.split('.').reduce((o, i) => o[i], asserting)
                if (obj_match === undefined || anno_match === undefined) {
                    // Matching is not violated if one of the checked values is missing from a comparator,
                    // but it is not a match without any positive matches.
                    continue
                }
                // check for match within Arrays as well
                if (!Array.isArray(obj_match)) { obj_match = [obj_match] }
                if (!Array.isArray(anno_match)) { anno_match = [anno_match] }
                if (!anno_match.every(item => obj_match.includes(item))) {
                    // Any mismatch (generous typecasting) will return a false result.
                    if (anno_match.some(item => obj_match.includes(item))) {
                        // NOTE: this mismatches if some of the Anno assertion is missing, which
                        // may lead to duplicates downstream.
                        // TODO: ticket this as an issue...
                        console.warn("Incomplete match may require additional handling. ", obj_match, anno_match)
                    }
                    break
                } else {
                    // High confidence this match is affirmative, continue checking others.
                    match = true
                }
            }
            return match
        }
        /**
         * Regularizes assertions on expanded objects to enforce the existence of a `source` key.
         * The return is only the value of the assertion, so the desired key must be applied upstream
         * from the scope of this function.
         * @param any val asserted value of the incoming annotation.
         * @param Object fromAnno parent annotation of the asserted value, as a handy metadata container.
         * @returns Object with `value` and `source` keys.
         */
        function buildValueObject(val, fromAnno) {
            let valueObject = {}
            valueObject.source = val.source || {
                citationSource: fromAnno["@id"] || fromAnno.id,
                citationNote: fromAnno.label || fromAnno.name || "Composed object from DEER",
                comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/deer"
            }
            valueObject.value = val.value || getVal(val)
            valueObject.evidence = val.evidence || fromAnno.evidence || ""
            return valueObject
        }
    },
    /**
     * Execute query for any annotations in RERUM which target the
     * id passed in. Promise resolves to an array of annotations.
     * @param {String} id URI for the targeted entity
     * @param [String] targetStyle other formats of resource targeting.  May be null
     */
    findByTargetId: async function (id, targetStyle = []) {
        let everything = Object.keys(localStorage).map(k => JSON.parse(localStorage.getItem(k)))
        if (!Array.isArray(targetStyle)) {
            targetStyle = [targetStyle]
        }
        targetStyle = targetStyle.concat(["target", "target.@id", "target.id"]) //target.source?
        let historyWildcard = { "$exists": true, "$size": 0 }
        let obj = { "$or": [], "__rerum.history.next": historyWildcard }
        for (let target of targetStyle) {
            //Entries that are not strings are not supported.  Ignore those entries.  
            //TODO: should we we let the user know we had to ignore something here?
            if (typeof target === "string") {
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
    cleanArray: function (arr) {
        let UTILS = this
        return arr.filter((arrItem) => {
            if (Array.isArray(arrItem)) {
                UTILS.warning("An annotation body value array contained an array.  We ignored it.  See ignored value below.")
                UTILS.warning(arrItem)
            } else if (typeof arrItem === "object") {
                //TODO how should we handle?
                UTILS.warning("An annotation body value array contained an object.  We ignored it.  See ignored value below.")
                UTILS.warning(arrItem)
            }
            return ["string", "number"].indexOf(typeof arrItem) > -1
        })
    },

    /**
     * Get the array of data from the container object, so long at it is one of the containers we support (so we know where to look.) 
     */
    getArrayFromObj: function (containerObj, inputElem) {
        let UTILS = this
        let cleanArray = []
        //Handle if what we are actualy looking for is inside containObj.value (DEER templates do that)
        let alsoPeek = ["@value", "value", "$value", "val"]
        for (let k of alsoPeek) {
            if (containerObj.hasOwnProperty(k)) {
                containerObj = containerObj[k]
                break
            }
        }
        let objType = containerObj.type || containerObj["@type"] || ""
        let arrKey = (inputElem !== null && inputElem.hasAttribute(DEER.LIST)) ? inputElem.getAttribute(DEER.LIST) : ""
        if (Array.isArray(objType)) {
            //Since type can be an array we have to pick one of the values that matches one of our supported container types.
            //This picks the first one it comes across, since it doesnt seem like we would have any preference.
            for (let t of objType) {
                if (DEER.CONTAINERS.indexOf(t) > -1) {
                    objType = t
                    break
                }
            }
        }
        if (DEER.CONTAINERS.indexOf(objType) > -1) {
            //Where it is we will find the array we seek differs between our supported types.  Perhaps we should store that with them in the config too.
            if (["Set", "List", "set", "list", "@set", "@list"].indexOf(objType) > -1) {
                if (arrKey === "") {
                    arrKey = "items"
                    UTILS.warning("Found attribute '" + DEER.INPUTTYPE + "' on an input, but there is no '" + DEER.LIST + "' attribute value.  DEER will use the default schema '" + arrKey + "' to find the array values for this " + objType + ".", inputElem)
                }
                if (containerObj.hasOwnProperty(arrKey)) { cleanArray = this.cleanArray(containerObj[arrKey]) } else {
                    console.error("Object of type (" + objType + ") is malformed.  The values could not be found in obj[" + arrKey + "].  Therefore, the value is empty.  See object below.")
                    console.log(containerObj)
                }
            } else if (["ItemList"].indexOf(objType > -1)) {
                if (arrKey === "") {
                    arrKey = "itemListElement"
                    UTILS.warning("Found attribute '" + DEER.INPUTTYPE + "' on an input, but there is no '" + DEER.LIST + "' attribute value.  DEER will use the default schema '" + arrKey + "' to find the the array values for this " + objType + ".", inputElem)
                }
                if (containerObj.hasOwnProperty(arrKey)) { cleanArray = this.cleanArray(containerObj[arrKey]) } else {
                    console.error("Object of type (" + objType + ") is malformed.  The values could not be found in obj[" + arrKey + "].  Therefore, the value is empty.  See object below.")
                    console.log(containerObj)
                }
            }
        } else {
            console.error("Object of type (" + objType + ") is not a supported container type.  Therefore, the value will be empty.  See object below..")
            console.log(containerObj)
        }
        return cleanArray
    },

    /**
     * Given an array, turn the array into a string where the values are separated by the given delimeter.
     */
    stringifyArray: function (arr, delim) {
        //TODO warn if arr is empty?
        try {
            return (arr.length) ? arr.join(delim) : ""
        } catch (e) {
            console.error("There was a join error on '" + arr + "'' using delimeter '" + delim + "'.")
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
    assertElementValue: function (elem, val, mapsToAnno) {
        let UTILS = this
        if (elem.type === "hidden") {
            if (elem.hasAttribute("value") && elem.value !== undefined) {
                if (!mapsToAnno || elem.value !== val) {
                    elem.$isDirty = true
                    if (elem.value !== val && elem.hasAttribute(DEER.INPUTTYPE)) {
                        UTILS.warning("Hidden element with a hard coded 'value' also contains attributes '" + DEER.KEY + "' and '" + DEER.INPUTTYPE + "'.  " +
                            "DEER takes this to mean the '" + elem.getAttribute(DEER.KEY) + "' annotation body value array will .join() into this string and pass a comparison operation. " +
                            "If the array value as string does not match the hidden element's value string (including empty string), it will be considered dirty and a candidate " +
                            "to be updated upon submission even though no interaction has taken place to change it.  Make sure this is what you want. \n" +
                            "If this hidden input value is reactive to other interactions then processing should be done by your own custom interaction handler. " +
                            "Remove the hard coded '" + DEER.KEY + "' or 'value' attribute.  This will make the DEER form input handler avoid processing of this input on page load. " +
                            "If you want form submission to handle the annotation behind the input, make sure to handle the $isDirty state appropriately and restore the '" + DEER.KEY + "' attribute before submission. " +
                            "See below.", elem)
                    }

                }
            }
        } else {
            if (elem.hasAttribute("value") && elem.value !== undefined) {
                //Empty strings count as a value.
                UTILS.warning("Element value is already set.  The element value should not be hard coded and will be overwritten by the annotation value '" + val + "'.  See below.", elem)
            }
            if (elem.hasAttribute(DEER.INPUTTYPE)) {
                UTILS.warning("This input element also has attribute '" + DEER.INPUTTYPE + "'.  This attribute is only for hidden inputs only.  The attribute is being removed to avoid errors.")
                elem.removeAttribute(DEER.INPUTTYPE)
            }
            elem.value = val
            elem.setAttribute("value", val)
        }
    },

    /**
     * Send a warning message to the console if dev has this feature turned on through the ROBUSTFEEDBACK config option.
     */
    warning: function (msg, logMe) {
        if (DEER.ROBUSTFEEDBACK.valueOf() && msg) {
            console.warn(msg)
            if (logMe) {
                console.log(logMe)
            }
        }
    }

}