export default {
    PREFIX: "deer", // namespace for this projects custom elements
    ID: "id", // attribute, URI for resource to render
    TYPE: "type", // attribute, JSON-LD @type
    TEMPLATE: "template", // attribute, enum for custom template
    KEY: "key", // attribute, key to use for annotation
    LABEL: "title", // attribute, alternate label for properties
    CONTEXT: "context", // attribute, JSON-LD @context, scoped
    ATTRIBUTION: "creator", // attribute, Web Annotation `creator`, scoped
    MOTIVATION: "motivation", // attribute, Web Annotation `motivation`, scoped
    LIST: "list", // attribute, property with resource array
    COLLECTION: "collection", // attribute, name of aggregating collection
    LISTENING: "listening", // attribute, name of container to watch for clicks
    LINK: "link", // attribute, location of href#[deer-id] for <a>s
    VIEW: "view", // selector, identifies render containers
    FORM: "form[type]", // selector, identifies data entry containers
    ITEMTYPE: "item-type", //attribute, specialty forms ('entity' by default)
    SOURCE: "source", // attribute, URI for asserting annotation
    EVIDENCE: "nv-evidence", // attribute, URI for supporting evidence
    INPUTTYPE: "input-type", //attribute, defines whether this is an array list, array set, or object 
    ARRAYDELIMETER: "array-delimeter", //attribute, denotes delimeter to use for array.join()

    INPUTS: ["input", "textarea", "dataset", "select"], // array of selectors, identifies inputs with .value
    CONTAINERS: ["ItemList", "ItemListElement", "List", "Set", "list", "set", "@list", "@set"], // array of supported list and set types the app will dig into for array values
    PRIMITIVES: ["name", "creator", "label"],

    URLS: {
        BASE_ID: "http://devstore.rerum.io/v1",
        CREATE: "http://tinydev.rerum.io/app/create",
        UPDATE: "http://tinydev.rerum.io/app/update",
        OVERWRITE: "http://tinydev.rerum.io/app/overwrite",
        QUERY: "http://tinydev.rerum.io/app/query",
        SINCE: "http://devstore.rerum.io/v1/since"
    },

    EVENTS: {
        CREATED: "created",
        EXPANDED: "expanded",
        UPDATED: "updated",
        LOADED: "loaded",
        NEW_VIEW: "view",
        NEW_FORM: "form",
        VIEW_RENDERED : "view-rendered",
        FORM_RENDERED : "form-rendered",
        CLICKED: "clicked"
    },

    SUPPRESS: ["__rerum", "@context"], //properties to ignore
    DELIMETERDEFAULT: ",", //Default delimeter for .split()ing and .join()ing 
    ROBUSTFEEDBACK: true, //Show warnings along with errors in the web console.  Set to false to only see errors.  

    /**
     * Add any custom templates here through import or copy paste.
     * Templates added here will overwrite the defaults in deer-render.js.
     * 
     * Each property must be lower-cased and return a template literal
     * or an HTML String.
     */
    TEMPLATES: {
        cat: (obj) => `<h5>${obj.name}</h5><img src="http://placekitten.com/300/150" style="width:100%;">`
    },

    version: "1.0.0"
}
