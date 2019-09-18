export default {
    ID: "deer-id",                  // attribute, URI for resource to render
    TYPE: "deer-type",              // attribute, JSON-LD @type
    TEMPLATE: "deer-template",      // attribute, enum for custom template
    KEY: "deer-key",                // attribute, key to use for annotation
    KEYDUPLICATE: "deer-key-duplicate", // attribute, notes input is a duplicate and app should ignore       
    LABEL: "title",                 // attribute, alternate label for properties
    CONTEXT: "deer-context",        // attribute, JSON-LD @context, scoped
    LIST: "deer-list",              // attribute, property with resource array
    COLLECTION: "deer-collection",  // attribute, name of aggregating collection
    LISTENING: "deer-listening",    // attribute, name of container to watch for clicks
    LINK: "deer-link",              // attribute, location of href#[deer-id] for <a>s
    VIEW: "deer-view, .deer-view",  // selector, identifies render containers
    FORM: "form[deer-type]",        // selector, identifies data entry containers
    ITEMTYPE: "deer-item-type",     //attribute, specialty forms ('entity' by default)
    SOURCE: "deer-source",          // attribute, URI for asserting annotation
    EVIDENCE: "nv-evidence",        // attribute, URI for supporting evidence
    ARRAYDELIMETER: "deer-array-delimeter", //attribute, denotes delimeter to use for array.join()
    ARRAYTYPE : "deer-array-type", //attribute, defines whether this array is a list or a set
    
    INPUTS: ["input","textarea","dataset","select"], // array of selectors, identifies inputs with .value
    CONTAINERS: ["ItemList","ItemListElement", "List", "Set", "list","set", "@list", "@set"], // array of supported list and set types the app will dig into for array values
    ENTITYNAME: "[deer-key='name']",// selector, value to grab for form entity label

    URLS: {
        BASE_ID: "http://devstore.rerum.io/v1",
        CREATE: "http://tinydev.rerum.io/app/create",
        UPDATE: "http://tinydev.rerum.io/app/update",
        OVERWRITE: "http://tinydev.rerum.io/app/overwrite",
        QUERY: "http://tinydev.rerum.io/app/query",
        SINCE: "http://devstore.rerum.io/v1/since"
    },

    EVENTS: {
        CREATED: "deer-created",
        UPDATED: "deer-updated",
        LOADED: "deer-loaded",
        NEW_VIEW: "deer-view",
        NEW_FORM: "deer-form",
        CLICKED: "deer-clicked"
    },

    SUPPRESS: ["__rerum","@context"],   //properties to ignore
    ATTRIBUTION: "testMachine",         //replace with user to attribute assertions
    DELIMETERDEFAULT: ",",              //Default delimeter for .split()ing and .join()ing 
    ROBUSTFEEDBACK : false,              //Show warnings along with errors in the web console.  Set to false to only see errors.  

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

    version: "alpha 0.8"
}