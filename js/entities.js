class Entity extends Object {
    constructor(entity) {
        super()
        this.data = entity
    }

    async expand(matchOn) {
        this.data = await expand(this, matchOn)
        return this
    }
}

class Annotation extends Object {
    constructor(annotation) {
        super()
        this.data = annotation
        this.normalized = normalize(annotation)
    }

    assertOn(entity, matchOn) {
        return applyAssertions(entity, this, matchOn)
    }

    normalize(annotation) {
        this.normalized = []
        if (!Array.isArray(annotation.body)) {
            annotation.body = [annotation.body]
        }
        annotation.body.forEach(body => {
            if (Array.isArray(body)) { body.forEach(normalizeValues) }
            Object.entries(body).forEach(([key, value]) => this.normalized.push({ [key]: buildValueObject(value, annotation) }))
        })
    }
}

/**
     * Take a known object with an id and query for annotations targeting it.
     * Discovered annotations are asserted on the original object and returned.
     * @param {Object} entity Target object to search for description
     */
async function expand(entity = new Entity({}), matchOn) {
    let findId = entity["@id"] ?? entity.id ?? entity
    if (typeof findId !== "string") { return Promise.resolve(entity) }
    const obj = fetch(findId).then(res => res.json()).then(res => Object.assign(entity, res))
    const annos = findByTargetId(findId).then(res => res.json()).then(res => res.map(anno => new Annotation(anno)))
    await Promise.all([obj, annos])
    applyAssertions(entity, annos, matchOn)
    return entity
}

/**
 * Extracts the value of an assertion.
 * @param Object assertOn target of the assertion(s).
 * @param Object annotation assertion Web Annotation.
 * @param string matchOn key to match on.
 * @returns Object with assertions value of the assertion.
 */
function applyAssertions(assertOn, annotation, matchOn) {
    if (Array.isArray(annotation)) { return annotation.map(getAssertion) }
    if (!annotation.hasOwnProperty('body')) { return }
    if (!checkMatch(assertOn, annotation, matchOn)) {

        const assertions = {}
        annotation.body.forEach((k, v) => {
            if (assertOn.hasOwnProperty(k)) {
                if (!Array.isArray(assertions[k])) { assertions[k] = [assertions[k]] }
                assertions[k].push(v)
            } else {
                assertions[k] = v
            }
        })
        return Object.assign(assertions, annotation.body)
    }
}

/**
 * Match on criteria(if exists) and return true if it appears to match on the values specified.
 * A true result means that the incoming assertion is likely to be relevant and authorized to 
 * augment the original object.
 * TODO: consider moving this up in scope, if useful
 * @param Object o existing Object with values to check.
 * @param Object a asserting Annotation to compare.
 * @param Array<String> matchOn dot-separated property paths on the two Objects to compare.
 * @returns Boolean if annotation should be considered a replacement for the current value.
 **/
function checkMatch(expanding, asserting, matchOn = ["__rerum.generatedBy", "creator"]) {
    for (const m of matchOn) {
        let obj_match = m.split('.').reduce((o, i) => o[i], expanding)
        let anno_match = m.split('.').reduce((o, i) => o[i], asserting)
        if (obj_match === undefined || anno_match === undefined) {
            // Matching is not violated if one of the checked values is missing from a comparator,
            // but it is not a match without any positive matches.
            continue
        }
        // check for match within Arrays as well
        if (!Array.isArray(obj_match)) { obj_match = [obj_match] }
        if (!Array.isArray(anno_match)) { anno_match = [anno_match] }
        if (!anno_match.every(item => obj_match.includes(item))) {
            // Any mismatch (generous typecasting) will return a false result.
            if (anno_match.some(item => obj_match.includes(item))) {
                // NOTE: this mismatches if some of the Anno assertion is missing, which
                // may lead to duplicates downstream.
                // TODO: ticket this as an issue...
                console.warn("Incomplete match may require additional handling. ", obj_match, anno_match)
            }
            break
        } else {
            // High confidence this match is affirmative, continue checking others.
            return true
        }
    }
    return false
}

/**
     * Execute query for any annotations in RERUM which target the
     * id passed in. Promise resolves to an array of annotations.
     * @param {String} id URI for the targeted entity
     * @param [String] targetStyle other formats of resource targeting.  May be null
     */
async function findByTargetId(id, targetStyle = [], queryUrl = "http://tinydev.rerum.io/app/query") {
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

export {
    Entity, Annotation
}