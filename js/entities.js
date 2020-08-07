
/**
     * Take a known object with an id and query for annotations targeting it.
     * Discovered annotations are asserted on the original object and returned.
     * @param {Object} entity Target object to search for description
     */
function expandEntity(entity={}, matchOn = ["__rerum.generatedBy", "creator"]) {
    let findId = entity["@id"] || entity.id || entity
    if (typeof findId !== "string") {
        return Promise.resolve(entity)
    }
    return fetch(findId).then(response => response.json())
        .then(obj => findByTargetId(findId)
            .then(function (annos) {
                for (let i = 0; i < annos.length; i++) {
                    let body
                    try {
                        body = annos[i].body
                    } catch (err) { continue }
                    if (!body) { continue }
                    if (body.evidence) {
                        obj.evidence = (typeof body.evidence === "object") ? body.evidence["@id"] : body.evidence;
                    }
                    if (!Array.isArray(body)) {
                        body = [body]
                    }
                    Leaf: for (let j = 0; j < body.length; j++) {
                        try {
                            if (!checkMatch(obj, annos[i], matchOn)) {
                                // this is not recognized as an annotation of interest by the interface
                                continue Leaf
                            }
                            if (annos[i].hasOwnProperty("__rerum") && annos[i].__rerum.history.next.length) {
                                // this may not be the most recent available
                                // TODO: this is incorrect. There could be an unrelated @id in the .next and isUpdatedBy() will never fire
                                continue Leaf;
                            }
                            let assertion = body[j]
                            let keys = Object.keys(assertion)
                            let k = keys[0]
                            if (keys.length > 1 || k === 0) {
                                console.warn("This assertion is not as expected and may not have been interpreted correctly.", assertion)
                            }
                            let val = assertion[k]
                            val = buildValueObject(val, annos[i])
                            // Assign this to the main object.
                            if (obj.hasOwnProperty(k)) {
                                // It may be already there as an Array with some various labels
                                if (typeof obj[k] === "string") {
                                    // This is probably a primitive and may be updated/replaced.
                                    console.log('Updating primitive value "' + obj[k] + '" with annotation.', annos[i])
                                    obj[k] = buildValueObject(val, annos[i])
                                } else if (Array.isArray(obj[k])) {
                                    if (isUpdatedBy(obj[k].source.citationSource, annos[i])) {
                                        const annoValues = (Array.isArray(val)) ? val : [val]
                                        annoValues.forEach(a => {
                                            // TODO: This is a brute force and not great.
                                            for (const v of obj[k]) {
                                                try {
                                                    if (isUpdatedBy(v.source.citationSource), a) {
                                                        v = a
                                                    }
                                                } catch (err) {
                                                    console.warn("I think a primitive got buried in here, but I'm moving on.")
                                                }
                                            }
                                        })
                                    } else {
                                        obj[k].push(buildValueObject(val, annos[i]))
                                    }
                                } else {
                                    if (isUpdatedBy(obj[k].source.citationSource, annos[i])) {
                                        // update value without creating an array
                                        obj[k] = buildValueObject(val, annos[i])
                                    } else {
                                        // Serialize both existing and new value as an Array
                                        obj[k] = [obj[k], buildValueObject(val, annos[i])]
                                    }
                                }
                            } else {
                                // or just tack it on
                                obj[k] = buildValueObject(val, annos[i])
                            }
                        } catch (err_1) { }
                    }
                }
                return obj
            })).catch(err => {
                console.error("Error expanding object:" + err)
                return err
            })
}

/**
     * Execute query for any annotations in RERUM which target the
     * id passed in. Promise resolves to an array of annotations.
     * @param {String} id URI for the targeted entity
     * @param [String] targetStyle other formats of resource targeting.  May be null
     */
async function findByTargetId(id, targetStyle = [],queryUrl="http://tinydev.rerum.io/app/query") {
    if (!Array.isArray(targetStyle)) {
        targetStyle = [targetStyle]
    }
    targetStyle = targetStyle.concat(["target", "target.@id", "target.id"]) //target.source?
    let historyWildcard = { "$exists": true, "$size": 0 }
    let obj = { "$or": [], "__rerum.history.next": historyWildcard }
    for (let target of targetStyle) {
        //Entries that are not strings are not supported.  Ignore those entries.  
        //TODO: should we we let the user know we had to ignore something here?
        if (typeof target === "string") {
            let o = {}
            o[target] = id
            obj["$or"].push(o)
        }
    }
    let matches = await fetch(queryUrl, {
        method: "POST",
        body: JSON.stringify(obj),
        headers: {
            "Content-Type": "application/json"
        }
    })
        .then(response => response.json())
        .catch((err) => console.error(err))
    return matches
}

/**
 * Regularizes assertions on expanded objects to enforce the existence of a `source` key.
 * The return is only the value of the assertion, so the desired key must be applied upstream
 * from the scope of this function.
 * @param any val asserted value of the incoming annotation.
 * @param Object fromAnno parent annotation of the asserted value, as a handy metadata container.
 * @returns Object with `value` and `source` keys.
 */
function buildValueObject(val, fromAnno) {
    let valueObject = {}
    valueObject.source = val.source || {
        citationSource: fromAnno["@id"] || fromAnno.id,
        citationNote: fromAnno.label || fromAnno.name || "Composed object from DEER",
        comment: "Learn about the assembler for this object at https://github.com/CenterForDigitalHumanities/deer"
    }
    valueObject.value = val.value || getValue(val)
    valueObject.evidence = val.evidence || fromAnno.evidence || ""
    return valueObject
}

function getValue(property, alsoPeek = [], asType) {
    // TODO: There must be a best way to do this...
    let prop;
    if (property === undefined || property === "") {
        console.error("Value of property to lookup is missing!")
        return undefined
    }
    if (Array.isArray(property)) {
        // It is an array of things, we can only presume that we want the array.  If it needs to become a string, local functions take on that responsibility.
        return property
    } else {
        if (typeof property === "object") {
            // TODO: JSON-LD insists on "@value", but this is simplified in a lot
            // of contexts. Reading that is ideal in the future.
            if (!Array.isArray(alsoPeek)) {
                alsoPeek = [alsoPeek]
            }
            alsoPeek = alsoPeek.concat(["@value", "value", "$value", "val"])
            for (let k of alsoPeek) {
                if (property.hasOwnProperty(k)) {
                    prop = property[k]
                    break
                } else {
                    prop = property
                }
            }
        } else {
            prop = property
        }
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
        return (prop.length === 1) ? prop[0] : prop
    }
}