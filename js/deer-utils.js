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
    listFromContainer: function () { },
    getValue: function (property, alsoPeek = [], asType) {
        // TODO: There must be a best way to do this...
        let prop;
        if (property === undefined || property === "") {
            console.error("Value of property to lookup is missing!")
            return undefined
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
    get getLabel() {
        return (obj, noLabel = "[ unlabeled ]", options = {}) => {
            if (typeof obj === "string") { return obj }
            let label = obj[options.label] || obj.name || obj.label || obj.title
            return (label) ? this.getValue(label) : noLabel
        }
    },
    /**
     * Take a known object with an id and query for annotations targeting it.
     * Discovered annotations are attached to the original object and returned.
     * @param {Object} obj Target object to search for description
     */
    async expand(obj) {
        let findId = obj["@id"]
        if (!findId) return Promise.resolve(obj)
        let getValue = this.getValue
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
                                        let aVal = getValue(val[k]);
                                        val[k] = {
                                            value: aVal,
                                            source: {
                                                citationSource: annos[i]["@id"],
                                                citationNote: annos[i].label || "Composed object from DEER",
                                                comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/TinyThings"
                                            }
                                        };
                                    }
                                    if (obj[k] !== undefined && annos[i].__rerum && annos[i].__rerum.history.next.length) {
                                        // this is not the most recent available
                                        // TODO: maybe check generator, etc.
                                        continue Leaf;
                                    }
                                    else {
                                        obj = Object.assign(obj, val);
                                    }
                                }
                                catch (err_1) { }
                            }
                        }
                    }
                    return obj
                })).catch(err => {
                    console.log("Error expanding object:" + err)
                    return obj
                })
    },
    /**
     * Execute query for any annotations in RERUM which target the
     * id passed in. Promise resolves to an array of annotations.
     * @param {String} id URI for the targeted entity
     */
    findByTargetId: async function (id) {
        let everything = Object.keys(localStorage).map(k => JSON.parse(localStorage.getItem(k)))
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
            .then(response => response.json())
            .catch((err) => console.log(err))
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
    }
}