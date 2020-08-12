const filesToCache = [
    '/',
    '/index.html',
    '/pages/offline.html',
    '/pages/404.html'
]

importScripts('entities.js')

const staticCacheName = 'deer-cache-20200730'

const IDBSTORE = "deer"
var db, objectStore

self.onmessage = message => {
    const args = message.data.args || {}
    switch (message.data.action) {
        case "init": {
            var DBOpenRequest = self.indexedDB.open(IDBSTORE, 2)
            DBOpenRequest.onsuccess = event => db = DBOpenRequest.result

            DBOpenRequest.onerror = event => console.error(event)

            DBOpenRequest.onupgradeneeded = event => {
                // db = event.target.result
                // Create an objectStore for this database
                objectStore = event.target.result.createObjectStore(IDBSTORE, { autoIncrement: true })
                objectStore.createIndex("__rerum","__rerum")
                console.log("Successfully upgraded db")
            }
        }
            break
        case "view":
            /**
             * Check for expanded object in the caches. If it exists, return it and check
             * for an update (will postMessage() twice). Otherwise, get and cache it.
             */
            if (!message.data || !message.data.id) break // Nothing to see here

            getItem(message.data.id, args)
            break
        case "record":
            break
        default:
    }
}

function getItem(id, args) {
    if(db){
        let objectStore = db.transaction(IDBSTORE, "readonly").objectStore(IDBSTORE)
    
        objectStore.get(id).onsuccess = function (event) {
            let item = event.target.result
            if (!item) {
                return expandEntity(id, args.matchOn).then(obj => {
                    let objectStore = db.transaction(IDBSTORE, "readwrite").objectStore(IDBSTORE)
                    objectStore.add(obj, obj['@id'])
                    postMessage({
                        item: obj,
                        action: "expanded",
                        id: obj['@id']
                    })
                })
            } else {
                expandEntity(id, args.matchOn).then(obj => {
                    let objectStore = db.transaction(IDBSTORE, "readwrite").objectStore(IDBSTORE)
                    objectStore.put(obj, obj['@id'])
                    postMessage({
                        item: obj,
                        action: "expanded",
                        id: obj['@id']
                    })
                })
                postMessage({
                    item: item,
                    action: "expanded",
                    id: item['@id']
                })
            }
        }
    } else {
        expandEntity(id, args.matchOn).then(obj => {
            postMessage({
                item: obj,
                action: "expanded",
                id: obj['@id']
            })
        })
    }
}

self.addEventListener('install', event => {
    console.log('Attempting to install service worker and cache static assets')
    // self.skipWaiting()
    event.waitUntil(
        caches.open(staticCacheName)
            .then(cache => {
                return cache.addAll(filesToCache)
            })
    )
})

self.addEventListener('activate', event => {
    console.log('Activating new service worker...')

    const cacheWhitelist = [staticCacheName]

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName)
                    }
                })
            )
        })
    )
    event.waitUntil(() => {
        let opening = new Promise()
        var DBOpenRequest = self.indexedDB.open(IDBSTORE, 1)
        DBOpenRequest.onsuccess = event => db = DBOpenRequest.result

        DBOpenRequest.onerror = event => opening.reject(console.error(event))

        DBOpenRequest.onupgradeneeded = event => {
            db = event.target.result
            // Create an objectStore for this database
            objectStore = db.createObjectStore(IDBSTORE, { keyPath: "id" })
            console.log("Successfully upgraded db")
            opening.resolve(db)
        }
        return opening
    })
})

self.addEventListener('fetch', event => {
    console.log('Fetch event for ', event.request.url)
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    console.log('Found ', event.request.url, ' in cache')
                    return response
                }
                console.log('Network request for ', event.request.url)
                return fetch(event.request)
                    .then(response => {
                        if (response.status === 404) {
                            return caches.match('pages/404.html')
                        }
                        return caches.open(staticCacheName).then(cache => {
                            cache.put(event.request.url, response.clone())
                            return response
                        })
                    })
            }).catch(error => {
                console.log('Error, ', error)
                return caches.match('/pages/offline.html')
            })
    )
})