import { default as UTILS } from '/js/deer-utils.js'
import { default as DEER } from '/js/deer-config.js'

/**
 * Get a certain property from an object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj containing a key that needs to be drawn
 * @param {String} key the name of the key in the obj we are looking for
 * @param {String} label The label to be displayed when drawn
 */
 DEER.TEMPLATES.prop = (obj, options = {}) => {
    let prop = obj[options.key] ?? obj.id ?? obj['@id'] ?? "[ undefined ]"
    let label = options.label ?? UTILS.getLabel(obj, prop)
    try {
        return `<span class="${prop}">${label}: ${UTILS.getValue(prop) ?? "[ undefined ]"}</span>`
    } catch (err) {
        return null
    }
}

/**
 * Retreive the best label for object and return it formatted as HTML to be drawn.  
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
DEER.TEMPLATES.label = (obj, options = {}) => {
    let prop = obj[options.key] ?? obj.id ?? obj['@id'] ?? "[ undefined ]"
    let label = options.label ?? UTILS.getLabel(obj, prop)
    try {
        return `${label}`
    } catch (err) {
        return null
    }
}

/**
 * Render an object expected to containa list.  
 * Consider that this may be changed to a Class component in the future.
 * @param {Object} obj some obj to be labeled
 * @param {Object} options for lookup
 */
DEER.TEMPLATES.list = function (obj, options = {}) {
    let tmpl = `<h2>${UTILS.getLabel(obj)}</h2>`
    if (options.list) {
        tmpl += `<ul>`
        try {
            obj[options.list].forEach((val, index) => {
                let name = UTILS.getLabel(val, (val.type || val['@type'] || index))
                tmpl += (val["@id"] && options.link) ? `<li ${DEER.ID}="${val["@id"]}"><a href="${options.link}${val["@id"]}">${name}</a></li>` : `<li ${DEER.ID}="${val["@id"]}">${name}</li>`
            })
        } catch(meh) {}
        tmpl += `</ul>`
    }
    return tmpl
}