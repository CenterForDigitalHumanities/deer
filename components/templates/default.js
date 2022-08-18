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
},
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