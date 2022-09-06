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

// Add custom templates in the /templates directory

// CDN at https://centerfordigitalhumanities.github.io/deer/releases/

// Attach service worker for offline support. 
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/js/serviceworker.js')
} else {
    console.log('Service workers are not supported in this browser.')
    importScripts('entities.js')
}

// Import custom components. The basic view.js is required for rendering.
const deerView = import('/components/view/view.js')
const deerEntity = import('/components/view/entity.js')

export {deerView, deerEntity}