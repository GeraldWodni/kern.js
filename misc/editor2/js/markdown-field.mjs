/* Textarea with markdown preview */
/* (c)copyright 2023 by Gerald Wodni <gerald.wodni@gmail.com> */
class MarkdownField extends HTMLElement {
    static formAssociated = true;
    static get observedAttributes() { return ["value", "textarea-class"]; }

    constructor() {
        super();
        this.lastValue = null;
        this._internals = this.attachInternals();
        const template = document.querySelector("template#markdown-field");

        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
        this.root =     this.shadowRoot.querySelector("div.root");
        this.textarea = this.root.querySelector("textarea");
        this.preview =  this.root.querySelector(".preview");
        this.previewContainer = this.root.querySelector(".preview-container");

        this.toggleHelpButton = this.root.querySelector(".toggle-help")
        this.help =     this.root.querySelector(".help-container");
    }

    connectedCallback() {
        this.textarea.addEventListener("change",   this.updateValue.bind( this ) );
        this.textarea.addEventListener("input",    this.updateValue.bind( this ) );

        this.toggleHelpButton.addEventListener("click", this.toggleHelp.bind( this ) );
        this.showPreview();

        this.value = this.getAttribute("value");
    }
    attributeChangedCallback( name, oldValue, newValue ) {
        switch( name ) {
            case "value": this.value = newValue; break;
            case "textarea-class": this.textarea.setAttribute("class", newValue ); break;
            case "newlines":
                this.newlines = newValue;
                this.updateMarkdown( this.value );
                break;
        }
    }

    showPreview() {
        this.previewContainer.style.display="block";
    }
    hidePreview() {
        this.previewContainer.style.display="none";
    }
    get previewVisible() {
        return this.previewContainer.style.display == "block";
    }
    togglePreview() {
        if( this.previewVisible )
            this.showPreview();
        else
            this.hidePreview();
    }
    showHelp() {
        this.help.style.display="block";
    }
    hideHelp() {
        this.help.style.display="none";
    }
    toggleHelp() {
        if( this.previewVisible ) {
            this.hidePreview();
            this.showHelp();
        }
        else {
            this.hideHelp();
            this.showPreview();
        }
    }

    updateMarkdown( sourceCode ) {
        if( this.postponedMarkdownTimeout ) {
            window.clearTimeout( this.postponedMarkdownTimeout );
            this.postponedMarkdownTimeout = null;
        }
        this.preview.innerHTML = marked.parse( sourceCode );
    }
    postponedUpdateMarkdown( sourceCode ) {
        this.nextSourceCode = sourceCode;
        if( this.postponedMarkdownTimeout )
            return;

        this.postponedMarkdownTimeout = window.setTimeout( () => {
            this.postponedMarkdownTimeout = null;
            this.updateMarkdown( this.nextSourceCode );
        }, 300 );
    }

    updateValue( val ) {
        const isEvent = val instanceof Event;
        if( isEvent )
            val = this.textarea.value;
        //console.log( "UPDATE:", isEvent, val );

        if( this.lastValue == val )
            return;

        if( this.newlines != "explicit" )
            val = val.replace( /([^\s]{2})\n/gm, "$1  \n" );

        if( isEvent )
            this.postponedUpdateMarkdown( val );
        else
            this.updateMarkdown( val );
        this._internals.setFormValue( val );
        this.lastValue = val;
    }

    set value( val ) {
        this.textarea.value = val;
        this.updateValue( val );
    }
    get value() {
        return this.lastValue;
    }
    get form() {
        return this._internals.form;
    }
    get name() {
        return this.getAttribute("name");
    }
    get type() {
        return this.localName;
    }
}

customElements.define('markdown-field', MarkdownField );
