importScripts('entities.js')

const IDBSTORE = "deer"
const db = new Promise((resolve, reject) => {
    var DBOpenRequest = self.indexedDB.open(IDBSTORE, 1) // upgrade version 1 to version 2 if schema changes
    DBOpenRequest.onsuccess = event => {
        console.log("Successfully opened db")
        return resolve(DBOpenRequest.result)
    }
    
    DBOpenRequest.onerror = event => reject(event)
    
    DBOpenRequest.onupgradeneeded = event => {
        const db = event.target.result
        // Create an objectStore for this database
        objectStore = db.createObjectStore(IDBSTORE, { autoIncrement: false, keyPath: 'id' }) // @id is an illegal keyPath
        console.log("Successfully upgraded db")
        return resolve(db)
    }
})

self.onmessage = message => {
    switch (message.data.action) {
        case "init": {
        }
            break
        case "view":
            /**
             * Check for expanded object in the caches. If it exists, return it and check
             * for an update (will postMessage() twice). Otherwise, get and cache it.
             */
            if (!message.data?.id) break // Nothing to see here
            getItem(message.data.id, message.data.args)
            break
        case "record":
            break
        default:
    }
}

function getItem(id, args = {}) {
    db.then(db => {
        let lookup = db.transaction(IDBSTORE, "readonly").objectStore(IDBSTORE)

        lookup.get(id).onsuccess = function (event) {
            let item = event.target.result
            if (item) {
                postMessage({
                    item: item,
                    action: "expanded",
                    id: item.id
                })
            }
            item = new Entity(item)
            item.data.id = item.data.id ?? item.data['@id']
            item.expand(args.matchOn).then(obj => {
                if(objectMatch(item.data, obj.data)) { return }
                const enterRecord = db.transaction(IDBSTORE, "readwrite").objectStore(IDBSTORE)
                const insertionRequest = enterRecord.put(obj.data)
                insertionRequest.onsuccess = function (event) {
                    postMessage({
                        item: obj.data,
                        action: "expanded",
                        id: obj.id
                    })
                }
                insertionRequest.onerror = function (event) {
                    console.log("Error: ", event)
                    postMessage({
                        error: event,
                        action: "error",
                        id: obj.id
                    })
                }
            })
        }
    })
}

function objectMatch (o1={}, o2={}) {
    const keys1 = Object.keys(o1)
    const keys2 = Object.keys(o2)
    if (keys1.length !== keys2.length) { return false }
    for (const k of keys1) {
      const val1 = o1[k]
      const val2 = o2[k]
      const recurseNeeded = isObject(val1) && isObject(val2);
      if ((recurseNeeded && !this.objectMatch(val1, val2)) 
        || (!recurseNeeded && val1 !== val2)) {
        return false
      }
    }
    return true
    function isObject(object) {
      return object != null && typeof object === 'object'
    }
  }

