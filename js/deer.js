/**
 * @module Data Encoding and Exhibition for RERUM (DEER)
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>

 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

 /**
    Not familiar with modern javascript classes?  https://javascript.info/class
    Need a list to test with?  http://devstore.rerum.io/v1/id/5c7f02e9e4b010f22a4f0adf
 */

import { default as renderer } from './deer-render.js'
import { default as DEER } from './deer-config.js'
Object.assign(DEER.TEMPLATES,{
    cat: (obj) => `<h5>${obj.name}</h5><img src="http://placekitten.com/300/150" style="width:100%;">`
})

const observables = document.querySelectorAll(DEER.VIEW)
Array.from(observables).forEach(elem=>new renderer(elem,DEER))

class Deer {
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
        /**
         * Update or create object in database. 
         * @param {Object} obj object to write to database
         * @returns {Promise} Fetch write to database resolves in new object state
         */
        upsert(obj) {
            // TODO: stub header or _id property to force the object ID in MongoDB
            let config = {
                url: obj["@id"] ? this.UPDATE_URL : this.CREATE_URL,
                method: obj["@id"] ? "PUT" : "POST",
                body: obj
            }
            return fetch(config.url, {
                    method: config.method,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8"
                    },
                    body: JSON.stringify(config.body)
                }).catch(error => console.error('Error:', error))
                .then(this.handleHTTPError)
                .then(response => response.json())
                .then(function (newState) {
                    localStorage.setItem(newState["@id"], JSON.stringify(newState.new_obj_state))
                    return newState.new_obj_state
                })
        }    
}
export {Deer}
