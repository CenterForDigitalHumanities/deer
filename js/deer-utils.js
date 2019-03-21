/**
 * @module DEER Data Encoding and Exhibition for RERUM
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>

 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

import {default as DEER} from './config.js'

export default {
    listFromCollection: function(){
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
        if (Array.isArray(property)) {
            prop = property.map(this.getValue)
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
                } else {
                    prop = property
                }
            }
        } else {
            prop = property
        }
        // JSON-LD says no nested arrays, but we know people.
        if (Array.isArray(prop)) {
            prop = prop.map(this.getValue)
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
    }

}