class DeerReport extends HTMLElement {
  constructor() {
    super();
    this.$isDirty = false;
    this.id = this.getAttribute(DEER.ID);
    this.elem = this;
    this.evidence = this.getAttribute(DEER.EVIDENCE) || DEER.DEFAULT_EVIDENCE; // inherited to inputs
    this.context = this.getAttribute(DEER.CONTEXT) || DEER.DEFAULT_CONTEXT; // unused
    this.attribution = this.getAttribute(DEER.ATTRIBUTION) || DEER.DEFAULT_ATTRIBUTION; // inherited to inputs
    this.motivation = this.getAttribute(DEER.MOTIVATION) || DEER.DEFAULT_MOTIVATION; // inherited to inputs
    this.type = this.getAttribute(DEER.TYPE) || DEER.DEFAULT_TYPE;
    this.inputs = Array.from(this.querySelectorAll(DEER.INPUTS.map(s => s + "[" + DEER.KEY + "]").join(",")));
    this.inputs.forEach(inpt => {
      inpt.addEventListener('input', (e) => {
        inpt.$isDirty = true; //Make the input dirty
        this.$isDirty = true; //Make the DeerReport dirty
      });
    });
    changeLoader.observe(this, {
      attributes: true
    });
    this.onsubmit = this.processRecord.bind(this);

    if (this.id) {
      //Do we want to expand for all types?
      UTILS.expand({ "@id": this.id })
        .then((obj) => {
          try {
            this.setFromObject(obj);
          } catch (err) {
            console.error(err);
          }
        });
    }
  }

  setFromObject(obj) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        let el = this.inputs.find(input => input.getAttribute(DEER.KEY) === key);
        if (el) {
          el.value = obj[key];
        }
      }
    }
  }

  processRecord() {
    let data = {};
    for (let input of this.inputs) {
      data[input.getAttribute(DEER.KEY)] = input.value;
    }
    return data;
  }
}

customElements.define('deer-report', DeerReport);
