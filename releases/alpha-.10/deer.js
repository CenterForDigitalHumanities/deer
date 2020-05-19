/**
 * @module DEER Data Encoding and Exhibition for RERUM (DEER)
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>
 * @version 0.7

 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

// Identify an alternate config location or only overwrite some items below.
import { default as DEER } from './deer-config.js'

// Overwrite or add certain values to the configuration to customize.

// new template
DEER.TEMPLATES.cat = (obj) => `<h5>${obj.name}</h5><img src="http://placekitten.com/300/150" style="width:100%;">`

// sandbox repository URLS
DEER.URLS = {
    BASE_ID: "http://devstore.rerum.io/v1",
    CREATE: "http://tinydev.rerum.io/app/create",
    UPDATE: "http://tinydev.rerum.io/app/update",
    QUERY: "http://tinydev.rerum.io/app/query",
    OVERWRITE: "http://tinydev.rerum.io/app/overwrite",
    SINCE: "http://devstore.rerum.io/v1/since"
}
// Render is probably needed by all items, but can be removed.
// CDN at https://centerfordigitalhumanities.github.io/deer/releases/
import { default as renderer, initializeDeerViews } from './deer-render.js'

// Record is only needed for saving or updating items.
// CDN at https://centerfordigitalhumanities.github.io/deer/releases/
import { default as record, initializeDeerForms } from './deer-record.js'

// fire up the element detection as needed
try {
    initializeDeerViews(DEER)
    initializeDeerForms(DEER)
} catch (err) {
    // silently fail if render or record is not loaded
}


