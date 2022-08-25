const filesToCache = [
    '/',
    '/index.html',
    '/pages/offline.html',
    '/pages/404.html',
    '/js/deer.js',
    '/js/deer-utils.js',
    '/js/worker.js',
    '/js/entities.js',
    '/js/deer-config.js',
    '/components/templates/default.js',
    '/components/view/view.js',
    '/components/view/entity.js',
    'https://unpkg.com/chota@latest',
    '/images/deerlogo_banner.png',
]
const staticCacheName = 'deer-cache-20200730'

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
    // event.waitUntil(() => {
    //     let opening = new Promise()
    //     var DBOpenRequest = self.indexedDB.open(IDBSTORE, 1)
    //     DBOpenRequest.onsuccess = event => db = DBOpenRequest.result

    //     DBOpenRequest.onerror = event => opening.reject(console.error(event))

    //     DBOpenRequest.onupgradeneeded = event => {
    //         db = event.target.result
    //         // Create an objectStore for this database
    //         var objectStore = db.createObjectStore(IDBSTORE, { keyPath: "id" })
    //         console.log("Successfully upgraded db")
    //         opening.resolve(db)
    //     }
    //     return opening
    // })
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
