console.log("CONFIG")
export default {
    ID: "deer-id",                  // attribute, URI for resource to render
    TYPE: "deer-type",              // attribute, JSON-LD @type
    TEMPLATE: "deer-template",      // attribute, enum for custom template
    KEY: "deer-key",                // attribute, key to use for annotation
    CONTEXT: "deer-context",        // attribute, JSON-LD @context, scoped
    LIST: "deer-list",              // attribute, property with resource array
    COLLECTION: "deer-collection",  // attribute, name of aggregating collection
    VIEW: "deer-view, .deer-view",  // selector, identifies render containers
    FORM: "form[deer-type]",        // selector, identifies data entry containers
    SOURCE: "deer-source",          // attribute, URI for asserting annotation
    EVIDENCE: "nv-evidence",        // attribute, URI for supporting evidence

    URLS: {
        BASE_ID: "http://devstore.rerum.io/v1",
        CREATE: "http://tinydev.rerum.io/app/create",
        UPDATE: "http://tinydev.rerum.io/app/update",
        QUERY: "http://tinydev.rerum.io/app/query",
        SINCE: "http://devstore.rerum.io/v1/since"
    },

    SUPPRESS: ["__rerum","@context"] // properties to ignore
}


// Dummy schema
// let fields = [{
// 	label: "test",
// 	default_value: "filled",
// 	options: {
// 		helptext: "",
// 		type: "number", // memo, text, number, email, url, tel, range, date, month, week, time, datetime, color
// 		required: false,
// 		readonly: false,
// 		min: null, // range, date
// 		max: null, // range, date
// 		step: null, // range
// 		pattern: null // tel
// 	},
// 	type: "rr:test" // web ontology from schema (JSON-LD @type)
// }, {
// 	label: "multiple",
// 	default_value: "grommit",
// 	options: {
// 		type: "memo"
// 	},
// 	type: "cidoc-crm:Stuff"
// }, {
// 	label: "multiple",
// 	default_value: "grommit",
// 	options: {
// 		type: "date"
// 	}
// }, {
// 	label: "multiple",
// 	default_value: "grommit",
// 	options: {
// 		type: "text"
// 	}
// }]