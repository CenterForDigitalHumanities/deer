/**
 * Web worker for retreiving and caching data from entities. 
 * @warning Not really a worker, but there are some serious CORS fraud 
 * that prevents this from working as intended.
 * 
 * @author cubap@slu
 */

import { Entity, EntityMap, objectMatch } from '//localhost:5500/js/entities.js'

const IDBSTORE = "deer"
const db = new Promise((resolve, reject) => {
    const DBOpenRequest = self.indexedDB.open(IDBSTORE, 1) // upgrade version 1 to version 2 if schema changes
    DBOpenRequest.onsuccess = event => {
        console.log("Successfully opened db")
        resolve(DBOpenRequest.result)
        return
    }
    
    DBOpenRequest.onerror = event => reject(event)
    
    DBOpenRequest.onupgradeneeded = event => {
        const db = event.target.result
        // Create an objectStore for this database
        const objectStore = db.createObjectStore(IDBSTORE, { autoIncrement: false, keyPath: 'id' }) // @id is an illegal keyPath
        objectStore.onsuccess = event => {
            console.log("Successfully upgraded db")
            resolve(db)
            return
        }
    }
})

self.onmessage = message => {
    switch (message.data.action) {
        case "view":
            /**
             * Check for expanded object in the caches. If it exists, return it and check
             * for an update (will postMessage() twice). Otherwise, get and cache it.
             */
            if (!message.data?.id) break // Nothing to see here
            if (!EntityMap.has(message.data.id)) {
                postMessage({
                    id: message.data.id,
                    action: "reload",
                    payload: new Entity(message.data.id, message.data.isLazy)
                })
            } else {
                postMessage({
                    id: message.data.id,
                    action: "update",
                    payload: EntityMap.get(message.data.id)?.assertions
                })
            }
            break
            case "record":
                break
        default:
        }
    }

    function getItem(id, args = {}) {
    db.then(db => {
        let lookup = db.transaction(IDBSTORE, "readonly").objectStore(IDBSTORE).get(id).onsuccess = (event) => {
            let item = event.target.result
            if (item) {
                postMessage({
                    item,
                    action: "expanded",
                    id: item.id
                })
            }
            item = new Entity(item ?? { id })
            const oldRecord = JSON.parse(JSON.stringify(item.data))
            item.data.id = item.data.id ?? item.data['@id']
            item.expand(args.matchOn).then(obj => {
                if (objectMatch(oldRecord, obj.data)) { return }
                const enterRecord = db.transaction(IDBSTORE, "readwrite").objectStore(IDBSTORE)
                const insertionRequest = enterRecord.put(obj.data)
                insertionRequest.onsuccess = function (event) {
                    postMessage({
                        item: obj.data,
                        action: "expanded",
                        id: obj.data.id
                    })
                }
                insertionRequest.onerror = function (event) {
                    console.log("Error: ", event)
                    postMessage({
                        error: event,
                        action: "error",
                        id: obj.data.id
                    })
                }
            })
        }
    })
}

/**
 * Careful with this. It's a global event listener simulation. The `document` object 
 * is not a real DOM element, so it doesn't have a `dispatchEvent` method. If more 
 * than one action type is needed, this should be refactored.
 */
if (typeof WorkerGlobalScope !== "undefined") {

    var document = {}
    document.dispatchEvent = msg => {
        const id = msg.detail.id
        const action = msg.detail.action
        const payload = msg.detail.payload

        postMessage({ id, action, payload })
    }
}

export default self
