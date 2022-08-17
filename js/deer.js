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

// Render is probably needed by all items, but can be removed.
// Record is only needed for saving or updating items.
// CDN at https://centerfordigitalhumanities.github.io/deer/releases/

// attach service worker for offline support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/js/serviceworker.js')
} else {
    console.log('Service workers are not supported in this browser.')
    importScripts('entities.js')
}

import('/components/view/view.js')
import('/components/view/entity.js')