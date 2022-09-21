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
    try {
       await navigator.serviceWorker.register('/serviceworker.js')
        .then(resp => {
            console.log("serviceworker.js register() response")
            console.log(resp)
        })
        .catch(err => {
            console.error("serviceworker.js register() ERROR")
            throw new Error(err)
        })
    } catch (e) {
        console.error("serviceworker.js register() error catch")
        console.error(e)
        // Maybe you do not want to use a service worker?
    }
} else {
    console.log('Service workers are not supported in this browser.')
    importScripts('//localhost:5500/js/entities.js')
}

// Import custom components. The basic view.js is required for rendering.
import('//localhost:5500/components/view/view.js')
import('//localhost:5500/components/view/entity.js')
// try{
//     let abc = navigator.serviceWorker.register("/serviceworker.js")
//         .then(resp => {
//             console.log("A")
//             console.log(resp)
//             return resp
//         })
//         .catch(err => {
//             console.log("B")
//             console.error(err)
//         })
// }
// catch(err){
//     console.error("C")
//     console.error(err)
// }