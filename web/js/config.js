const CONFIG = {
    "fields": [{
        "label": "short describing",
        "default_value": "",
        "options": {
            "helptext": "Enter a short description of the contents of this page.",
            "type": "text", // array_, memo, text, number, email, url, tel, range, date, month, week, time, datetime, color
            "required": false,
            "validation": null, // function(value){true||false}
            "min": null, // range, date
            "max": null, // range, date
            "step": null, // range
            "pattern": null // tel
        },
        "motivation":"describing",
        "type": "schema:description" // web ontology from schema (JSON-LD @type)
    }, {
        "label": "people",
        "default_value": "",
        "options": {
            "type": "array_text",
            "helptext": "Individuals within this image"
        },
        "motivation":"describing",
        "type": "schema:Person"
    }, {
        "label": "places",
        "default_value": "",
        "options": {
            "type": "array_text",
            "helptext": "Locations pictured"
        },
        "motivation":"describing",
        "type": "schema:Place"
    }, {
        "label": "events",
        "default_value": "",
        "options": {
            "type": "array_text",
            "helptext": "Event occurring in this image"
        },
        "motivation":"describing",
        "type": "schema:Event"
    }, {
        "label": "notes",
        "default_value": "",
        "options": {
            "type": "array_memo",
            "helptext": "Open notes field"
        },
        "motivation":"describing",
        "type": "schema:note"
    }]
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