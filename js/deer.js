/**
 * @module Data Encoding and Exhibition for RERUM (DEER)
 * @author Patrick Cuba <cubap@slu.edu>
 * @author Bryan Haberberger <bryan.j.haberberger@slu.edu>

 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */

 /**
    Not familiar with modern javascript classes?  https://javascript.info/class
    Need a list to test with?  http://devstore.rerum.io/v1/id/5c7f02e9e4b010f22a4f0adf
 */

import {
    DeerRender as renderer
} from './deer-render.js'
import {default as DEER} from './deer-config.js'

const observables = document.querySelectorAll(DEER.VIEW)
Array.from(observables).forEach(elem=>new renderer(elem))

/**
 * The best way to 
 */

class Deer {
    constructor(collectionName) {
        this.TYPES = {Event:"Event", Person:"Person", Location:"Location", List:"List", Thing:"Thing", Unknown:"Unknown"} //More like an enum
        this.defaultTemplate = {
            "@context": "",
            "@type": "List",
            "label": "List of Entities",
            "resources": [],
            "__rerum": {
                "alpha": "true",
                "APIversion": "0.8.0",
                "createdAt": Date.now(),
                "isOverwritten": "",
                "isReleased": "",
                "history": {
                    "next": [],
                    "previous": "",
                    "prime": "root"
                },
                "releases": {
                    "next": [],
                    "previous": "",
                    "replaces": ""
                },
                "generatedBy": "DEER tool"
            },
            "@id": this.suppliedURL
        }
        this.suppliedURL = ""
        this.suppliedObj = this.defaultTemplate
        this.templateType = "Unknown"
        this.resources = []

        /*
        if (!localStorage.getItem("CURRENT_LIST_ID")) {
            localStorage.setItem("CURRENT_LIST_ID", this.suppliedURL)
        }
        */
        this.default = {
            context: "https:schema.org",
            type: "Thing",
            name: "new Entity",
            creator: "https://undefined.net"
        }

        // "Constants"
        this.DEFAULT_LIST_ID = "li01" //http://devstore.rerum.io/v1/id/5c7f02e9e4b010f22a4f0adf
        this.BASE_ID = "http://devstore.rerum.io/v1"
        this.CREATE_URL = "http://tinydev.rerum.io/app/create"
        this.UPDATE_URL = "http://tinydev.rerum.io/app/update"
        this.QUERY_URL = "http://tinydev.rerum.io/app/query"
        this.FOCUS_OBJECT = document.getElementsByTagName("deer-view")[0] || document.getElementById("deer-view")

        //FIXME: This is giving errors I can't seem to get around.
        /*
        this.newObjectLoader = new MutationObserver(this.newObjectRender(this.defaultTemplate)) //this.newObjectRender(this.TEMPLATES.default)
        this.newObjectLoader.observe(this.FOCUS_OBJECT, {
            attributes: true
        })
        */

        /**
            * Want to be able to do like DEER.TEMPLATES.Person to have it build the HTML form for a person.
            * Remember the functions have to already have been defined above to be added into the template here and
            * that is what scopes them to DEER and to the TEMPLATE so they can be used throughout.  This is so from the client
            * a user could do DEER.renderPerson(personOBj) or DEER.TEMPLATE.Person(personObj).  We can move scope around now
            * freely if this becomes undesirable or unmanagable.  The use of the 'this' keyword required to manage scope this way.

        */
        this.TEMPLATES = {
            /* Templater functions to produce HTML for the types of things we are expecting */
            Person: this.renderPerson,
            List: this.renderList,
            Event: this.renderEvent,
            Location: this.renderLocation,
            Thing: this.renderThing,
            Unknown: this.renderUnknown,
            json: this.renderJSON,
            default: this.renderElement,
            /* Helper fuctions used in more than one of the renderes defined above, scoped here as well as DEER */
            determineType: this.determineType,
            TYPES : this.TYPES,
            renderProp : this.renderProp,
            getValue : this.getValue,
            renderDepiction: this.renderDepiction
        }
    }
            /**
         * Fetch the JSON from a URL
         * @param {String} id: http or https URL
         */
        async resolveJSON(id) {
            let j = {}
            if(id){
                await fetch(id)
                    .then(this.handleHTTPError)
                    .then(resp => j = resp.json())
                    .catch(error => alert(error)) //DEER.err(error) TODO:Need to make a DEER error class
            }
            else{
                alert("No id provided to resolve for JSON.  Make sure you have an id.") //TODO: DEER.err()
            }
            return j
        }

        /**
         * Generate a new object URI for a resource. Abstract additional
         * properties to annotations.
         * @param {Object} obj complete resource to process
         * @param {Object} attribution creator and generator identities
         */
        async create(obj, attribution, evidence) {
            let mint = {
                "@context": obj["@context"] || this.default.context,
                "@type": obj["@type"] || this.default.type,
                "name": this.getValue(obj.name || obj.label) || this.default.name,
                "creator": attribution || this.default.creator
            }
            if (evidence) {
                mint.evidence = evidence
            }
            const newObj = await fetch(CREATE_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8"
                    },
                    body: JSON.stringify(mint)
                })
                .then(this.handleHTTPError)
                .then(response => response.json())
            const listID = localStorage.getItem("CURRENT_LIST_ID") || this.DEFAULT_LIST_ID
            let list = await get(listID)
            const objID = newObj.new_obj_state["@id"]
            list.resources.push({
                "@id": objID,
                "label": newObj.new_obj_state.name
            })
            try {
                list = await fetch(UPDATE_URL, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json; charset=utf-8"
                        },
                        body: JSON.stringify(list)
                    })
                    .then(this.handleHTTPError)
                    .then(response => response.json().new_obj_state)
                    .catch(err => Promise.reject(err))
            } catch (err) {}
            localStorage.setItem(list["@id"], JSON.stringify(list))
            localStorage.setItem("CURRENT_LIST_ID", list["@id"])
            let annotations = []
            for (var key of Object.keys(obj)) {
                if (["@context", "@type", "name"].indexOf(key) > -1) {
                    continue
                }
                let annotation = {
                    "@context": "",
                    "@type": "Annotation",
                    "motivation": "describing",
                    "target": objID,
                    "body": {}
                }
                annotation.body[key] = obj[key]
                if (attribution) {
                    annotation.creator = attribution
                }
                if (evidence) {
                    annotation.evidence = evidence
                }
                annotations.push(annotation)
            }
            // just enforcing the delay
            let temp = await Promise.all(annotations.map(upsert))
            return newObj.new_obj_state
        }
        /**
         * Set this as the DEER object to draw's URL
         * @param {String} url A URL that leads to a JSON object we want to draw
         */
        async drawUsingURL(url){
            this.suppliedURL = url
            let resolvedCollection = await this.resolveJSON(url)
            this.suppliedObj = resolvedCollection
            this.templateType = this.determineType(resolvedCollection)
            this.resources = [] //??
            this.draw()
        }
        /**
         * Take in a new object for DEER to understand as its supplied object for drawing
         * @param {Object} obj Some JSON object to draw to th screen
         */
        drawUsingObject(obj){
            this.suppliedURL = (obj.id)?obj.id:(obj["@id"])?obj["@id"]:""
            this.suppliedObj = obj //Or should we make a clone instead?
            this.templateType = this.determineType(obj)
            this.resources = [] //??
            this.draw()
        }
        /**
         * Set this as the DEER object to draw's URL
         * @param {String} url The URL of some supplied json object
         */
        async supplyURL(url){
            this.suppliedURL = url
            let resolvedCollection = await this.resolveJSON(url)
            this.suppliedObj = resolvedCollection
            this.templateType = this.determineType(resolvedCollection)
            this.resources = [] //??
        }
         /**
         * Set this as the DEER object to draw
         * @param {Object} obj some json object we are hoping to draw to the screen
         */
        supplyObj(obj){
            this.suppliedObj = obj
            this.templateType = this.determineType(obj)
            this.resources = [] //??
        }
        /**
         * Interact with known DEER templates to draw a json object to the screen
         * In particular, this draws the object we know was supplied by the user. 
         * @see this.drawUsingObject
         * @see this.drawUsingURL
         */
        async draw(){
            let options = {}
            let html = await this.TEMPLATES[this.templateType](this.suppliedObj, options)
            //Note this won't keep appending templates, it will replace what is there.  
            this.FOCUS_OBJECT.innerHTML = html
        }
        /**
         * Given an object, try to determine what type it is so we know how to draw it.
         * @param {Object} obj some json object we are hoping has a discernable type
         */
        determineType(obj){
            let t = "Unknown"
            let objType = (obj.type) ? obj.type : (obj["@type"]) ? obj["@type"] : "not found"

            if(objType !== "not found"){
                if(Array.isArray(objType)){
                    //See if we understand any of the values in the array
                    for(let type in objType){
                        let g = this.determineType({"type":objType[type]})
                        if(g !== "Unknown"){
                            t = g
                            return this.TYPES[t]
                            break;
                        }
                    }
                }
                else if(typeof objType === "string"){
                    //See if we know anything by this type
                    objType = objType.charAt(0).toUpperCase() + objType.slice(1) //capitalize first letter
                    t = objType
                    if(!this.TYPES[t]){
                        switch(objType){
                            case "ItemList":
                                t = "List"
                                break;
                            case "Other":
                                t = "Thing"
                                break;
                            default:
                                t="Unknown"
                        }
                    }
                    return this.TYPES[t]
                }
                else{
                    //obj.type was not an array or string...should we be expected something else or is this malformed?
                    //return this.TYPES["Unknown"]
                }
            }
            
        }

        /**
            An error handler for various HTTP traffic scenarios
        */
        handleHTTPError(response){
            if (!response.ok){
                let status = response.status
                switch(status){
                    case 400:
                        console.log("Bad Request")
                    break;
                    case 401:
                        console.log("Request was unauthorized")
                    break;
                    case 403:
                        console.log("Forbidden to make request")
                    break;
                    case 404:
                        console.log("Not found")
                    break;
                    case 500:
                        console.log("Internal server error")
                    break;
                    case 503:
                        console.log("Server down time")
                    break;
                    default:
                        console.log("unahndled HTTP ERROR")
                }
                throw Error("HTTP Error: "+response.statusText)
            }
            return response
        }

        /**
         * Update or create object in database. 
         * @param {Object} obj object to write to database
         * @returns {Promise} Fetch write to database resolves in new object state
         */
        upsert(obj) {
            // TODO: stub header or _id property to force the object ID in MongoDB
            let config = {
                url: obj["@id"] ? this.UPDATE_URL : this.CREATE_URL,
                method: obj["@id"] ? "PUT" : "POST",
                body: obj
            }
            return fetch(config.url, {
                    method: config.method,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8"
                    },
                    body: JSON.stringify(config.body)
                }).catch(error => console.error('Error:', error))
                .then(this.handleHTTPError)
                .then(response => response.json())
                .then(function (newState) {
                    localStorage.setItem(newState["@id"], JSON.stringify(newState.new_obj_state))
                    return newState.new_obj_state
                })
        }
        /**
         * Get the value of a certain property as a certain type
         * @param {?} property some obj.thing being passed in
         * @param {String} asType some typeof thing you are expecting back as the value
         */
        getValue(property, asType) {
            // TODO: There must be a best way to do this...
            let prop;
            if(property === undefined){
                //There is nothing to be done...
                return false;
            }
            /*
            if (!Array.isArray(property)) { //Do you mean to is if Array instead of if not is array?
                //FIXME: This is breaking things because getValue is undefined and I am confused. what are you trying to do?
                let getValue = "";
                prop = property.map(getValue) //This produces an array, so again im confused about what you're trying to
                //Too many errors to wrap my head around what the fix is, so I am commenting this out for now.
            }
            */
            if (Array.isArray(property)) { //Do you mean to is if Array instead of if not is array?
               prop = property //Presumably we need to do something special here?
            }
            else if (typeof property === "object") {
                // TODO: JSON-LD insists on "@value", but this is simplified in a lot
                // of contexts. Reading that is ideal in the future.
                prop =
                    p.hasOwnProperty("@value") && p["@value"] ||
                    p.hasOwnProperty("value") && p["value"] ||
                    p.hasOwnProperty("$value") && p["$value"] ||
                    p.hasOwnProperty("val") && p["val"]
            } 
            else {
                prop = property
            }
            try {
                switch (asType.toUpperCase()) {
                    case "STRING":
                        prop = prop.toString();
                        break
                    case "NUMBER":
                        prop = parseFloat(prop);
                        break
                    case "INTEGER":
                        prop = parseInt(prop);
                        break
                    case "BOOLEAN":
                        prop = !Boolean(["false", "no", "0", "", "undefined", "null"].indexOf(String(prop).toLowerCase().trim()));
                        break
                    default:
                        //The developer didn't say, lets assume string
                        prop = prop.toString();
                }
            } catch (err) {
                if (asType) {
                    throw new Error("asType: '" + asType + "' is not possible.\n" + err.message)
                } else {
                    // no casting requested
                }
            } finally {
                return prop
            }
        }
        /**
         * Update the DOM with a template from the application.
         * @param {HTMLElement} elem The DOM Element in which the template will be placed
         * @param {function} tmp Function to return Template literal
         */
        async renderElement(elem, tmp) {
            while (elem.firstChild) {
                elem.removeChild(elem.firstChild)
            }
            if (tmp) {
                elem.innerHTML = await tmp
            }
        }

        /**
         * Take a known object with an id and query for annotations targeting it.
         * Discovered annotations are attached to the original object and returned.
         * @param {Object} obj Target object to search for description
         */
        async expand(obj) {
            let findId = obj["@id"]
            let annos = await findByTargetId(findId)
            // TODO: attach evidence to each property value
            // add each value in a predictable way
            // type properties for possible rendering?
            for (let i = 0; i < annos.length; i++) {
                let body = annos[i].body
                if (!Array.isArray(body)) {
                    body = [body]
                }
                Leaf: for (let j = 0; j < body.length; j++) {
                    if (body[j].evidence) {
                        let evId = (typeof body[j].evidence === "object") ? body[j].evidence["@id"] : body[j].evidence
                        obj.evidence = await get(evId)
                    } else {
                        let val = body[j]
                        let k = Object.keys(val)[0]
                        if (!val.Source) {
                            // include an origin for this property, placehold madsrdf:Source
                            let aVal = val[k].value || val[k]
                            val[k] = {
                                value: aVal,
                                Source: {
                                    citationSource: annos[i]["@id"],
                                    citationNote: annos[i].label || "Composed object from DEER",
                                    comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/TinyThings"
                                }
                            }
                        }
                        if (obj[k] !== undefined && annos[i].__rerum && annos[i].__rerum.history.next.length) {
                            // this is not the most recent available
                            // TODO: maybe check generator, etc.
                            continue Leaf
                        } else {
                            obj = Object.assign(obj, val)
                        }
                    }
                }
            }
            return obj
        }

        /**
         * Execute query for any annotations in RERUM which target the
         * id passed in. Promise resolves to an array of annotations.
         * @param {String} id URI for the targeted entity
         */
        async findByTargetId(id) {
            let everything = Object.keys(localStorage).map(JSON.parse(localStorage.getItem(k)))
            let obj = {
                target: id
            }
            let matches = await fetch(this.QUERY_URL, {
                method: "POST",
                body: JSON.stringify(obj),
                headers: {
                    "Content-Type": "application/json"
                }
            })
            .then(this.handleHTTPError)
            .then(response => response.json())
            let local_matches = everything.filter(o => o.target === id)
            matches = local_matches.concat(matches)
            return matches
        }

        /**
         * Removes known "@type" names and sets the one passed in.
         * Intended for Elements representing an entity for styling.
         * @param {String} className to be set
         */
        setClass(className) {
            // TODO: Config a list of these and run remove(...CLASSES) instead
            this.FOCUS_OBJECT.classList.remove(...this.TYPES)
            this.FOCUS_OBJECT.classList.add(className)
        }

        /**
         * Observer callback for rendering newly loaded objects. Checks the
         * mutationsList for "deer-object" attribute changes.
         * @param {Array} mutationsList of MutationRecord objects
         */
        async newObjectRender(mutationsList) {
            for (var mutation of mutationsList) {
                if (mutation.attributeName === "deer-object") {
                    let id = this.FOCUS_OBJECT.getAttribute("deer-object")
                    let data = await expand(await get(id))
                    renderElement(this.FOCUS_OBJECT, template.byObjectType(data))
                }
            }
        }

        /**
         * Triggers a render call with a new primary item in focus.
         * This may also be useful as a # or path.
         * @param {String} id URL or URI that identifies the object
         */
        focusOn(id) {
            this.FOCUS_OBJECT.setAttribute('deer-object', id)
        }

        /**
         * Return template literal for given object type. DEER ships
         * with Person, List, Event, JSON, and default.
         * Extend this.TEMPLATES to add more.
         * @param {Object} obj to render
         * @param {String} typeOverride to force a template
         * @param {any} options specific to the template function
         */
        async getTemplate(obj, typeOverride, options) {
            let templateFunction = function () {}
            let type = typeOverride || obj["@type"] || "default"
            templateFunction = this.TEMPLATES[type]
            setClass(obj["@type"])
            let tmpl = await templateFunction(obj, options)
            return tmpl
        }

        /**
         * Get a certain property from an object and return it formatted as HTML to be drawn.  
         * @param {Object} obj some obj containing a key that needs to be drawn
         * @param {String} key the name of the key in the obj we are looking for
         * @param {String} label The label to be displayed when drawn
         */
        renderProp(obj, key, label) {
            let prop = obj.key
            //let altLabel = options.altLabel || prop
            let altLabel = label
            //let prefix = (options.prefix || "deer") + "-"
            let prefix = "deer-"
            try {
                let pattern = new RegExp("(" + prefix + ")+", "g")
                return `<span class="${(prefix+prop).trim().replace(/\s+/g,"-").replace(/:/g,"-").replace(pattern,prefix).normalize("NFC").toLowerCase()}">${altLabel || prop}: ${this.getValue(obj[prop]) || "[ undefined ]"}</span>`
            } catch (err) {
                return null
            }
        }
        /**
         * The TEMPLATED renderer to draw JSON to the screen
         * @param {Object} obj some json to be drawn as JSON
         * @param {Object} options additional properties to draw with the JSON
         */
        renderJSON(obj, options) {
            let indent = options.indent || 4
            let replacer = options.replacer || null
            try {
                return `<pre>${JSON.stringify(obj, replacer, indent)}</pre>`
            } catch (err) {
                return null
            }
        }
        /**
         * The TEMPLATED renderer to draw an JSON to the screen as some HTML template
         * @param {Object} obj some json of type Entity to be drawn
         * @param {Object} options additional properties to draw with the Entity
         */
        renderEntity(obj, options = {}) {
            let elem = `<label>${this.getValue(obj[options.label])||this.getValue(obj.name)||this.getValue(obj.label)||"[ unlabeled ]"}</label>`
            let tmp = []
            for (prop in obj) {
                tmp += renderProp(obj, options)
            }
            return elem
        }
        /**
         * The TEMPLATED renderer to draw JSON to the screen
         * @param {Object} obj some json of type Person to be drawn
         * @param {Object} options additional properties to draw with the Person
         */
        renderPerson(obj, options) {
            try {
                let label = this.getValue(obj.label)||this.getValue(obj.name)||this.getValue(obj.label)||"[ unlabeled ]"
                //let prop = this.renderProp(obj, options.birthDate || "birthDate", "Birth Date") + renderProp(obj, options.deathDate || "deathDate", "Death Date") //Too many errors
                let prop = this.renderProp(obj, "birthDate", "Birth Date") + this.renderProp(obj, "deathDate", "Death Date")
                //let dep = this.renderDepiction(obj, options) TODO need to write this function
                //let famName = this.getValue(obj[options.familyName])||this.getValue(obj.familyName)||"[ unknown ]"
                //let givenName = this.getValue(obj[options.givenName])||this.getValue(obj.givenName)||""
                let famName = this.getValue(obj.familyName)||"[ unknown ]"
                let givenName = this.getValue(obj.givenName)||""
                let elem = `<label>Label: ${label}</label>`
                elem += `<div class="mc-name">Name: ${famName}, ${givenName}</div>`
                elem += prop
                //elem += dep 
                return elem
            } catch (err) {
                return null
            }
            return null
        }
        /**
         * The TEMPLATED renderer to draw JSON to the screen
         * @param {Object} obj some json of type Event to be drawn
         * @param {Object} options additional properties to draw with the Event
         */
        renderEvent(obj, options) {
            try {
                let elem = `<h1> EVENT </h1>`
                return elem
            } catch (err) {
                return null
            }
            return null
        }
        /**
         * The TEMPLATED renderer to draw JSON to the screen
         * @param {Object} obj some json of type List to be drawn
         * @param {Object} options additional properties to draw with the List
         */
        async renderList(obj, options) {
            /**
            *   Define rendering helper functions for lists here
            */
            async function getResourcesFromList (listObj){
                //TODO FIXME How can we know where to look to get resources out of a list
                //If resources are a URL, we may have to fetch them
                let resources = []
                if(listObj.resources){
                    resources = listObj.resources
                }
                else if(listObj.itemListElement){
                    resources = listObj.itemListElement
                }
                else{
                    //Not a list we recognize the format of, even if we recognize the TYPE
                }
                return resources
            }
            /* END OF LIST HELPERS */


            let resources = await getResourcesFromList(obj)
            try {
                let elem = `<label>This is a list, here's what is inside</label>`
                if(resources.length > 0){
                    for(let item in resources){
                        //SO right here we need to determine what type of thing this thing is for rendering.
                        let listItemType = this.determineType(resources[item])
                        //Remember your scope, 'this' is actually TEMPLATES, so load from templates like
                        let innardsHTML  = await this[listItemType](resources[item])
                        elem += innardsHTML
                    }
                }
                else{
                    elem += `<div class="mc-list-entry">This list is empty or the resources could not be found</div>`
                }
                return elem
            } catch (err) {
                return null
            }
            return null
        }
        /**
         * The TEMPLATED renderer to draw JSON to the screen
         * @param {Object} obj some json of type Unknown to be drawn
         * @param {Object} options additional properties to draw with the Unknown
         */
        renderUnknown(obj, options){
            console.log("RENDER AN UNKNOWN")
            try {
                let elem = `<label>This list is of an unknown type</label>`
                elem += `<div class="mc-name">${this.getValue(obj["@id"])}</div>`
                return elem
            } catch (err) {
                return null
            }
            return null
        }
        /**
         * The TEMPLATED renderer to draw JSON to the screen
         * @param {Object} obj some json of type Location to be drawn
         * @param {Object} options additional properties to draw with the Location
         */
        renderLocation(obj, options){
            try {
                let elem = `<h1>LOCATION</h1>`
                return elem
            } catch (err) {
                return null
            }
            return null
        }
        /**
         * The TEMPLATED renderer to draw JSON to the screen
         * @param {Object} obj some json of type Thing to be drawn
         * @param {Object} options additional properties to draw with the Thing
         */
        renderThing(obj, options){
            try {
                let elem = `<h1>THING</h1>`
                return elem
            } catch (err) {
                return null
            }
            return null
        }
    
}
export {Deer}
