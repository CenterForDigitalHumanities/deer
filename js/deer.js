/**
 * @module Data Encoding and Exhibition for RERUM (DEER)
 * @author Patrick Cuba <cubap@slu.edu>
 * This code should serve as a basis for developers wishing to
 * use TinyThings as a RERUM proxy for an application for data entry,
 * especially within the Eventities model.
 * @see tiny.rerum.io
 */
class Deer {
    constructor(collectionURL) {
        this.collectionURL = collectionURL
        this.collection = localStorage.getItem(collectionURL) || {
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
            "@id": collectionURL
        }
        this.resources = []
        if (!localStorage.getItem("CURRENT_LIST_ID")) {
            localStorage.setItem("CURRENT_LIST_ID", collectionURL)
        }

        this.default = {
            context: "https:schema.org",
            type: "Thing",
            name: "new Entity",
            creator: "https://undefined.net"
        }

        // "Constants"
        this.DEFAULT_LIST_ID = "li01"
        this.BASE_ID = "http://devstore.rerum.io/v1"
        this.CREATE_URL = "http://tinydev.rerum.io/app/create"
        this.UPDATE_URL = "http://tinydev.rerum.io/app/update"
        this.QUERY_URL = "http://tinydev.rerum.io/app/query"
        this.TYPES = ["Event", "Person", "Location", "List", "Thing"]
        this.FOCUS_OBJECT = document.getElementsByTagName("deer-view")[0] || document.getElementById("deer-view")

        this.TEMPLATES = {
            Person: this.renderPerson,
            List: this.renderList,
            Event: this.renderEvent,
            default: this.renderEntity,
            json: this.renderJSON
        }

        this.newObjectLoader = new MutationObserver(newObjectRender)
        this.newObjectLoader.observe(this.FOCUS_OBJECT, {
            attributes: true
        })

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
            .then(response => response.json())
            .then(function (newState) {
                localStorage.setItem(newState["@id"], JSON.stringify(newState.new_obj_state))
                return newState.new_obj_state
            })
    }
    getValue(property, asType) {
        // TODO: There must be a best way to do this...
        let prop;
        if (!Array.isArray(property)) {
            prop = property.map(getValue)
        }
        if (typeof property === "object") {
            // TODO: JSON-LD insists on "@value", but this is simplified in a lot
            // of contexts. Reading that is ideal in the future.
            prop =
                p.hasOwnProperty("@value") && p["@value"] ||
                p.hasOwnProperty("value") && p["value"] ||
                p.hasOwnProperty("$value") && p["$value"] ||
                p.hasOwnProperty("val") && p["val"]
        } else {
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
        }).then(response => response.json())
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

    // Templates

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

    renderProp(obj, options) {
        let prop = options.prop
        let altLabel = options.altLabel || prop
        let prefix = (options.prefix || "deer") + "-"
        try {
            let pattern = new RegExp("(" + prefix + ")+", "g")
            return `<span class="${(prefix+prop).trim().replace(/\s+/g,"-").replace(/:/g,"-").replace(pattern,prefix).normalize("NFC").toLowerCase()}">${altLabel || prop}: ${this.getValue(obj[prop]) || "[ undefined ]"}</span>`
        } catch (err) {
            return null
        }
    }

    renderJSON(obj, options) {
        let indent = options.indent || 4
        let replacer = options.replacer || null
        try {
            return `<pre>${JSON.stringify(obj, replacer, indent)}</pre>`
        } catch (err) {
            return null
        }
    }

    renderEntity(obj, options = {}) {
        let elem = `<label>${this.getValue(obj[options.label])||this.getValue(obj.name)||this.getValue(obj.label)||"[ unlabeled ]"}</label>`
        let tmp = []
        for (prop in obj) {
            tmp += renderProp(obj, options)
        }
        return elem
    }

    renderPerson(obj, options = {}) {
        try {
            let elem = `<label>${this.getValue(obj.label)||this.getValue(obj.name)||this.getValue(obj.label)||"[ unlabeled ]"}</label>`
            elem += `<div class="mc-name">${this.getValue(obj[options.familyName])||this.getValue(obj.familyName)||"[ unknown ]"}, ${this.getValue(obj[options.givenName])||this.getValue(obj.givenName)||""}</div>`
            elem += renderProp(obj, options.birthDate || "birthDate", "Birth Date") + renderProp(obj, options.deathDate || "deathDate", "Death Date")
            elem += renderDepiction(obj, options)
            return elem
        } catch (err) {
            return null
        }
        return null
    }
    renderEvent(obj, options) {
        let elem = ``
        try {
            return elem
        } catch (err) {
            return null
        }
        return null
    }
    renderList(obj, options) {
        let elem = ``
        try {
            return elem
        } catch (err) {
            return null
        }
        return null
    }
}

export {Deer}