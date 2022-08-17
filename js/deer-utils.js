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

// import * as CryptoJS from "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"
import { default as DEER } from './deer-config.js'

var worker = new Worker('./js/worker.js', { type: 'module' })

const utils = {
    worker,
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
            // Value of property to lookup is missing!
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
    postView(entity, matchOn = ["__rerum.generatedBy", "creator"]) {
        let UTILS = this
        const id = entity["@id"] ?? entity.id ?? entity
        if (typeof id !== "string") {
            UTILS.warning("Unable to find URI in object:", entity)
            return entity
        }
        const message = {
            id,
            action: "view",
            args: {
                matchOn: matchOn,
                entity: entity
            }
        }
        this.worker.postMessage(message)
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
    assertElementValue: function (elem, obj) {
        delete elem.$isDirty
        let deerKeyValue = elem.getAttribute(DEER.KEY)
        let mapsToAnno = false
        let assertedValue = ""
        if (obj.hasOwnProperty(deerKeyValue)) {
            if (obj[deerKeyValue].evidence) elem.setAttribute(DEER.EVIDENCE, obj[deerKeyValue].evidence)
            if (obj[deerKeyValue].motivation) elem.setAttribute(DEER.MOTIVATION, obj[deerKeyValue].motivation)
            if (obj[deerKeyValue].creator) elem.setAttribute(DEER.ATTRIBUTION, obj[deerKeyValue].creator)

            //Then there is a key on this object that maps to the input.  
            //It is either an annotation or was part of the object directly.  If it has a 'source' property, we assume it is an annotation.
            assertedValue = this.getValue(obj[deerKeyValue])
            mapsToAnno = (typeof obj[deerKeyValue] === "object" && obj[deerKeyValue].hasOwnProperty("source"))
            if (mapsToAnno) {
                elem.setAttribute(DEER.SOURCE, this.getValue(obj[deerKeyValue].source, "citationSource"))
            }
            let annoBodyObjectType = (typeof assertedValue === "object") ? assertedValue.type || assertedValue["@type"] || "" : ""
            let delim = elem.getAttribute(DEER.ARRAYDELIMETER) || DEER.DELIMETERDEFAULT || ","
            let arrayOfValues = []
            if (Array.isArray(assertedValue)) {
                /**
                 * This could mean multiple annotations of similar bodies were put together.
                 * This could mean that the key on the orignal object also had annotations existing for it was put together.
                 * This could mean that the key on the original object was an array already, and may not contain anything we can get a value from.
                 * We will preference the first entry of the array that is an annotation.  
                 * If no annotations are found, DEER will aribitrarily pick the last string or number encountered.   
                 * DEER does not technically support this situation, but can make a best guess and help it along...
                 */
                this.warning("There are multiple possible values for key '" + deerKeyValue + "'. See below. ", assertedValue)
                let arbitraryAssertedValue = ""
                for (let entry of assertedValue) {
                    if (["string", "number"].indexOf(typeof entry) > -1) {
                        //We found it and understand it, but we preference annotation objects so look at the rest of the entries.
                        //Consequently, if no annotations are found, the last string/number entry will be the one DEER uses.
                        mapsToAnno = false
                        elem.setAttribute(DEER.SOURCE, this.getValue(entry.source, "citationSource"))
                        assertedValue = arbitraryAssertedValue = this.getValue(entry)
                    } else if (typeof entry === "object") {
                        if (entry.hasOwnProperty(deerKeyValue) && entry[deerKeyValue].hasOwnProperty("source")) {
                            //Then this is an object like {deerKeyValue:{value:"hopefully", source:"anno/123"}} and can be preferenced
                            mapsToAnno = true
                            elem.setAttribute(DEER.SOURCE, this.getValue(entry.source, "citationSource"))
                            assertedValue = arbitraryAssertedValue = this.getValue(entry[deerKeyValue])
                            break
                        } else if (entry.hasOwnProperty("source")) {
                            //Then this is an object like {value:"hopefully", source:"anno/123"} and can be preferenced
                            mapsToAnno = true
                            elem.setAttribute(DEER.SOURCE, this.getValue(entry.source, "citationSource"))
                            assertedValue = arbitraryAssertedValue = this.getValue(entry)
                            break
                        }
                    }
                }
                if (arbitraryAssertedValue) { this.warning("DEER arbitrarily chose the value '" + arbitraryAssertedValue + "'.") } else {
                    console.error("DEER did not understand any of these values.  Therefore, the value will be an empty string.")
                    assertedValue = ""
                }
            } else {
                switch (typeof assertedValue) {
                    //getValue either returned an object because it could not find obj.value or because obj.value was an object.  
                    case "object":
                        if (mapsToAnno) {
                            //Then getValue found an annotation DEER understood and the body.value was an object.
                            if (elem.getAttribute(DEER.INPUTTYPE)) {
                                //Only an element noted as a DEER.INPUTTYPE would have this kind of annotation behind it.  For others, it is an error.  
                                if (annoBodyObjectType === "" || elem.getAttribute(DEER.INPUTTYPE) !== annoBodyObjectType) {
                                    //The HTML input should note the same type of container as the annotation so helper functiions can determine if it is a supported in DEER.CONTAINERS
                                    this.warning("Container type mismatch!.  See attribute '" + DEER.INPUTTYPE + "' on element " + elem.outerHTML + "." +
                                        " The element is now dirty and will overwrite the type noted in the annotation seen below upon form submission." +
                                        " If the type of the annotation body is not a supported type then DEER will not be able to get the array of values.", obj[deerKeyValue])
                                }
                                if (elem.getAttribute(DEER.INPUTTYPE) === "object") {
                                    try {
                                        assertedValue = JSON.stringify(assertedValue)
                                    } catch (err) {
                                        assertedValue = ""
                                    }
                                } else {
                                    arrayOfValues = this.getArrayFromObj(assertedValue, el)
                                    assertedValue = this.stringifyArray(arrayOfValues, delim)
                                }
                            } else {
                                //This should have been a string or number.  We do not support whatever was meant to be here.  
                                console.error("We do not support annotation body values that are objects, unless they are a supported container object and the element " + elem.outerHTML + " notes '" + DEER.INPUTTYPE + "'.  Therefore, the value of annotation is being ignored.  See annotation below.")
                                console.log(obj[deerKeyValue])
                                assertedValue = ""
                            }
                        } else {
                            //Then getValue returned an object and could not confirm it was an annotation.  We cannot find a value. 
                            console.error("Could not find 'value' in the object body.  See below.")
                            console.log(obj[deerKeyValue])
                            assertedValue = ""
                        }
                        break
                    case "string":
                    case "number":
                        //getValue either found that obj[deerKeyValue] was a string or found that it was an object with a 'value' that was a string or number. 
                        //The asserted value is already set and we know whether or not it mapsToAnno, so do nothing.  Keep this here for future handling. 
                        break
                    default:
                        //An undefined situation perhaps?
                        console.error("We do not support values of this type '" + typeof assertedValue + "'.  Therefore, the value of annotation is being ignored.  See annotation below.")
                        console.log(obj[deerKeyValue])
                        assertedValue = ""
                }
            }
        }
        if (elem.type === "hidden") {
            if (elem.hasAttribute("value") && elem.value !== undefined) {
                if (!mapsToAnno || elem.value !== assertedValue) {
                    elem.$isDirty = true
                    if (elem.value !== assertedValue && elem.hasAttribute(DEER.INPUTTYPE)) {
                        this.warning("Hidden element with a hard coded 'value' also contains attributes '" + DEER.KEY + "' and '" + DEER.INPUTTYPE + "'.  " +
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
            if (mapsToAnno && elem.hasAttribute("value") && elem.value !== undefined) {
                //Empty strings count as a value.
                this.warning("Element value is already set.  The element value should not be hard coded and will be overwritten by the annotation value '" + assertedValue + "'.  See below.", elem)
            }
            if (elem.hasAttribute(DEER.INPUTTYPE)) {
                this.warning("This input element also has attribute '" + DEER.INPUTTYPE + "'.  This attribute is only for hidden inputs only.  The attribute is being removed to avoid errors.")
                elem.removeAttribute(DEER.INPUTTYPE)
            }
            elem.value = assertedValue
            elem.setAttribute("value", assertedValue)
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
    },
    /**
     * Stringifies a JSON object (not any randon JS object).
     *
     * It should be noted that JS objects can have members of
     * specific type (e.g. function), that are not supported
     * by JSON.
     * @license https://github.com/fraunhoferfokus/JSum/blob/master/LICENSE
     * @param {Object} obj JSON object
     * @returns {String} stringified JSON object.
     */
    serialize: function (obj) {
        if (Array.isArray(obj)) {
            return JSON.stringify(obj.map(i => serialize(i)))
        } else if (typeof obj === 'object' && obj !== null) {
            return Object.keys(obj)
                .sort()
                .map(k => `${k}:${serialize(obj[k])}`)
                .join('|')
        }

        return obj
    },
    checksum: function (inputData) {
        if (typeof inputData === "object") {
            inputData = this.serialize(data)
        }
        return CryptoJS.MD5(data)
    }
}

export default utils