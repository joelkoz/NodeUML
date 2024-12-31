import { metaModel } from "./metaModel.js";

// Class for displaying and editing class name and stereotype
class ClassHeaderPanel {
    constructor(jsonClass, stereotypeList) {
      this.jsonClass = jsonClass;
      this.stereotypeList = stereotypeList || [];
      this.element = null;
      this.nameInput = null;
      this.stereotypeSelect = null;
    }
  
    onNameChange(newName) {}
    onStereotypeChange(newStereotype) {}
  
    createPanel() {
      // Container
      this.element = document.createElement("div");
      this.element.style.marginBottom = "15px";
  
      // Class name label
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Class Name:";
      nameLabel.style.display = "block";
      this.element.appendChild(nameLabel);
  
      // Name input
      this.nameInput = document.createElement("input");
      this.nameInput.type = "text";
      this.nameInput.value = this.jsonClass?.name || "";
      this.nameInput.classList.add("attribute-editor-input");
      this.nameInput.addEventListener("blur", () => {
        this.onNameChange(this.nameInput.value);
      });
      this.element.appendChild(this.nameInput);
  
      // Stereotype label
      const stereoLabel = document.createElement("label");
      stereoLabel.textContent = "Stereotype:";
      stereoLabel.style.display = "block";
      stereoLabel.style.marginTop = "10px";
      this.element.appendChild(stereoLabel);
  
      // Stereotype select
      this.stereotypeSelect = document.createElement("select");
      this.stereotypeSelect.classList.add("attribute-editor-input");
  
      // <None> option
      const noneOption = document.createElement("option");
      noneOption.value = "";
      noneOption.textContent = "<None>";
      this.stereotypeSelect.appendChild(noneOption);
  
      // Add stereotypes
      this.stereotypeList.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st._id;
        opt.textContent = st.name;
        this.stereotypeSelect.appendChild(opt);
      });
  
      // Pre-select if there's a stereotype on the class
      if (this.jsonClass?.stereotypes && this.jsonClass.stereotypes[0]) {
        const existingId = this.jsonClass.stereotypes[0]._id;
        this.stereotypeSelect.value = existingId;
      } else {
        this.stereotypeSelect.value = "";
      }
  
      this.stereotypeSelect.addEventListener("change", () => {
        const selectedId = this.stereotypeSelect.value;
        if (!selectedId) {
          this.onStereotypeChange(null);
        } else {
          const stObj = this.stereotypeList.find((x) => x._id === selectedId);
          this.onStereotypeChange(stObj || null);
        }
      });
      this.element.appendChild(this.stereotypeSelect);
  
      return this.element;
    }
  }

//
// BasePanel for shared code between AttributePanel and OperationPanel.
class BasePanel {
    constructor(items) {
      this.items = items || [];
      this.currentIndex = 0;
      this.isEditing = false;
  
      this.lines = [];
      this.inputLine = null;
      this.element = null;
  
      this.dataTypes = []; // For data type auto-complete
      this.awesomplete = null;
    }
  
    // Event handlers to be overridden by subclass:
    onNewItem(item) {}
    onUpdateItem(item) {
        console.log('Base panel onUpdateItem');
    }
    onRemoveItem(itemId) {}
  
    setDataTypes(dataTypes) {
      this.dataTypes = dataTypes || [];
    }
  
    createAutoComplete() {
        console.log('Override me!');
    }


    createPanel(titleText) {
        this.container = document.createElement("div");
        this.container.classList.add("attribute-editor-panel");

        this.element = document.createElement("div");
        this.element.classList.add("attribute-editor-panel-body");
    
        if (titleText) {
            const title = document.createElement("h3");
            title.textContent = titleText;
            // this.element.appendChild(title);
            this.container.appendChild(title);
        }
    
        // 5 lines (3rd is the input line)
        for (let i = 0; i < 5; i++) {
            const line = document.createElement("div");
            line.classList.add("attribute-editor-line");
            this.element.appendChild(line);
    
            if (i === 2) {
            this.inputLine = document.createElement("input");
            this.inputLine.type = "text";
            this.inputLine.classList.add("attribute-editor-input");
            this.setupInputEvents();
    
            // Setup Awesomplete for data type auto-complete
            setTimeout(() => { this.createAutoComplete();}, 0);
    
            line.appendChild(this.inputLine);
            } else {
            const label = document.createElement("span");
            label.classList.add("attribute-editor-label");
            line.appendChild(label);
            this.lines.push(label);
            }
        }
        // return this.element;
        this.container.appendChild(this.element);
        return this.container;
    }
  
    setupInputEvents() {
        this.inputLine.addEventListener("keydown", (e) => {
          this.handleKeyDown(e);
        });
      
        this.inputLine.addEventListener("input", (e) => {
          this.handleInput(e);
        });
    }

    onNextEditor() {
        console.log('No behavior for onNextEditor');
    }

    handleKeyDown(e) {
        // If Awesomplete is open, let it handle Up/Down/Enter for suggestion navigation
        if (this.awesomplete && this.awesomplete.opened) {
            return;
        }
      
        if (e.key === "ArrowUp") {
          e.preventDefault();
          this.navigateUp();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          this.navigateDown();
        } else if (e.key === "Enter") {
          e.preventDefault();
          // If the line is blank AND we are on a blank new item at the end, we might close or navigate
          if (
            this.inputLine.value.trim() === "" &&
            this.currentIndex === this.items.length
          ) {
            this.onNextEditor();
          } else {
            this.navigateDown();
          }
        } else if (e.key === "Backspace" && this.inputLine.value === "") {
          e.preventDefault();
          this.handleBackspaceOnEmptyLine();
        } else if (e.key === "Delete" && this.inputLine.value === "") {
          e.preventDefault();
          this.deleteItem();
        } else if (
          this.inputLine.selectionStart === 0 &&
          !["+", "-", "#"].includes(e.key) &&
          !/[a-zA-Z]/.test(e.key)
        ) {
          // If the first character typed is not +, -, #, or alpha, prevent it
          e.preventDefault();
        }
    }
      
    handleInput(e) {
        const value = this.inputLine.value;
      
        // If the user typed exactly 1 alpha as the first character, auto-prepend "+"
        if (value.length === 1 && /^[a-zA-Z]$/.test(value[0])) {
          this.inputLine.value = "+" + value;
        }
      
        // Mark as editing
        this.isEditing = true;
      
        // Validate for red text or normal
        this.validateInput();
      
        // Evaluate Awesomplete if a colon ":" is found
        const lastColonIndex = this.inputLine.value.lastIndexOf(":");
        if (lastColonIndex !== -1) {
          this.awesomplete.list = this.dataTypes; // Provide the full data type list
          this.awesomplete.evaluate();
        } else {
          this.awesomplete.list = [];
          this.awesomplete.close();
        }
    }
  
    validateInput() {
      if (this.isIncomplete()) {
        this.inputLine.classList.add("invalid");
      } else {
        this.inputLine.classList.remove("invalid");
      }
    }
  
    // Called by handleKeyDown
    navigateUp() {
      if (this.isIncomplete()) {
        return;
      }
      if (this.isEditing && this.inputLine.value.trim() === "") {
        this.removeCurrentItem();
      } else if (this.isEditing) {
        this.saveItem();
      }
      if (this.currentIndex > 0) {
        this.currentIndex--;
      }
      this.updateDisplay();
    }
  
    navigateDown() {
      if (this.isIncomplete()) {
        return;
      }
      if (this.isEditing && this.inputLine.value.trim() === "") {
        this.removeCurrentItem();
      } else if (this.isEditing) {
        this.saveItem();
      }
      if (this.currentIndex < this.items.length) {
        this.currentIndex++;
      }
      this.updateDisplay();
    }

    deleteItem() {
      if (!this.items[this.currentIndex]) {
        return;
      }
      const item = this.items[this.currentIndex];
      if (item._id) {
        this.onRemoveItem(item._id);
      }
      this.items.splice(this.currentIndex, 1);
      this.updateDisplay();
    }

    handleBackspaceOnEmptyLine() {
        if (this.isEditing && this.inputLine.value.trim() === "") {
          this.removeCurrentItem();
        }
        if (this.currentIndex > 0) {
          this.currentIndex--;
        }
        this.updateDisplay();
    }

    // Abstract / to be overridden:
    updateDisplay() {
      throw new Error("updateDisplay() must be implemented in subclass");
    }
    isIncomplete() {
      throw new Error("isIncomplete() must be implemented in subclass");
    }
    saveItem() {
      throw new Error("saveItem() must be implemented in subclass");
    }
    removeCurrentItem() {
      throw new Error("removeCurrentItem() must be implemented in subclass");
    }
  }
  
  //
  // AttributePanel extends BasePanel
  //
  class AttributePanel extends BasePanel {
    constructor(attributes) {
      super(attributes);
    }
  
    createAutoComplete() {
        this.awesomplete = new Awesomplete(this.inputLine, {
            list: this.dataTypes,
            minChars: 0,
            autoFirst: true,
            filter: (text, input) => {
            const lastColon = input.lastIndexOf(":");
            if (lastColon === -1) {
                return false;
            }
            const typed = input.slice(lastColon + 1).trim();
            if (typed === "") {
                return true;
            }
            return Awesomplete.FILTER_CONTAINS(text, typed);
            },
            replace: (text) => {
            const lastColon = this.inputLine.value.lastIndexOf(":");
            this.inputLine.value =
                this.inputLine.value.slice(0, lastColon + 1) + " " + text;
            },
            empty: function () {},
        });

        this.inputLine.addEventListener("awesomplete-selectcomplete", () => {
            this.inputLine.value = this.inputLine.value;  // "Lock in" selection
            this.isEditing = true;
            this.validateInput();
        });
    }


    updateDisplay() {
      this.lines.forEach((l) => (l.textContent = ""));
  
      // Show the previous two
      if (this.currentIndex > 1) {
        this.lines[0].textContent = this.formatAttribute(
          this.items[this.currentIndex - 2]
        );
      }
      if (this.currentIndex > 0) {
        this.lines[1].textContent = this.formatAttribute(
          this.items[this.currentIndex - 1]
        );
      }
  
      // Show the next two
      if (this.currentIndex + 1 < this.items.length) {
        this.lines[2].textContent = this.formatAttribute(
          this.items[this.currentIndex + 1]
        );
      }
      if (this.currentIndex + 2 < this.items.length) {
        this.lines[3].textContent = this.formatAttribute(
          this.items[this.currentIndex + 2]
        );
      }
  
      if (this.items[this.currentIndex]) {
        this.inputLine.value = this.formatAttribute(this.items[this.currentIndex]);
      } else {
        this.inputLine.value = "";
      }
      this.validateInput();
    }
  
    isIncomplete() {
      const val = this.inputLine.value.trim();
      if (val === "") {
        return false;
      }
      const regex =
        /^([\+\-\#])[a-zA-Z][a-zA-Z0-9]*\s*:\s*[a-zA-Z][a-zA-Z0-9]*(\s*\[(\d+|\d+\.\.\d+|\d+\.\.\*)\])?$/;
      return !regex.test(val);
    }
  
    formatAttribute(attr) {
      if (!attr) {
        return "";
      }
      const visibilityMap = {
        public: "+",
        protected: "#",
        private: "-",
      };
      const visibility = visibilityMap[attr.visibility] || "+";
      const name = attr.name || "";
      const type = attr.type?.className || attr.type?.name || "";
      let mult = attr.multiplicity;
      if (!mult || mult === "0..1") {
        mult = "";
      } else {
        mult = ` [${mult}]`;
      }
      return `${visibility}${name}: ${type}${mult}`;
    }
  
    saveItem() {
      const val = this.inputLine.value.trim();
      if (val === "") {
        return;
      }
      const parsed = this.parseAttribute(val);
      if (!parsed) {
        return;
      }
      let attribute;
      if (this.items[this.currentIndex]) {
        attribute = this.items[this.currentIndex];
        const original = JSON.stringify(attribute);
        attribute.visibility = parsed.visibility;
        attribute.name = parsed.name;
        attribute.type = { name: parsed.type };
        attribute.multiplicity = parsed.multiplicity;
        if (JSON.stringify(attribute) !== original) {
          this.onUpdateItem(attribute);
        }
      } else {
        attribute = {
          _type: "UMLAttribute",
          visibility: parsed.visibility,
          name: parsed.name,
          type: { name: parsed.type },
          multiplicity: parsed.multiplicity,
        };
        this.items.push(attribute);
        this.onNewItem(attribute);
      }
      this.isEditing = false;
    }
  
    parseAttribute(value) {
      const regex =
        /^([\+\-\#])([a-zA-Z][a-zA-Z0-9]*)\s*:\s*([a-zA-Z][a-zA-Z0-9]*)(\s*\[(\d+|\d+\.\.\d+|\d+\.\.\*)\])?$/;
      const match = value.match(regex);
      if (!match) {
        return null;
      }
      const visibilityMap = {
        "+": "public",
        "#": "protected",
        "-": "private",
      };
      return {
        visibility: visibilityMap[match[1]],
        name: match[2],
        type: match[3],
        multiplicity: match[5] || "0..1",
      };
    }

  
    removeCurrentItem() {
      if (this.items[this.currentIndex]) {
        const attribute = this.items[this.currentIndex];
        if (attribute._id) {
          this.onRemoveItem(attribute._id);
        }
        this.items.splice(this.currentIndex, 1);
      }
      this.isEditing = false;
    }
  }
  
  class OperationPanel extends BasePanel {
    constructor(operations) {
      super(operations);
    }
  
    ////////////////////////////////////////////////////////////////////
    // 1) createAutoComplete()
    ////////////////////////////////////////////////////////////////////
    createAutoComplete() {
      // We'll create a fairly liberal filter that doesn't forcibly close on spaces,
      // but the ultimate logic for open/close is in handleInput() (cursor-based).
      this.awesomplete = new Awesomplete(this.inputLine, {
        list: this.dataTypes,
        minChars: 0,
        autoFirst: true,
        filter: (text, input) => {
          // We'll do a partial match on the substring after the last colon
          // BUT only if handleInput determined we are actively typing a data type.
          const pos = this.inputLine.selectionStart;
          // Where is the last colon behind the cursor?
          const colPos = this.findRelevantColon(pos);
          if (colPos < 0) {
            return false;
          }
          const typed = input.slice(colPos + 1, pos);
          const typedNoLeadingSpaces = typed.trimStart();
          if (typedNoLeadingSpaces === "") {
            // If user typed a colon and no letters yet, show unfiltered
            return true;
          }
          return Awesomplete.FILTER_CONTAINS(text, typedNoLeadingSpaces);
        },
        replace: (text) => {
          // We insert the chosen text at the position of the relevant colon substring
          const pos = this.inputLine.selectionStart;
          const colPos = this.findRelevantColon(pos);
          if (colPos < 0) {
            // Something weird, fallback
            this.inputLine.value += " " + text;
          } else {
            const before = this.inputLine.value.slice(0, colPos + 1);
            const after = this.inputLine.value.slice(pos);
            // Insert one space, then text
            this.inputLine.value = before + " " + text + after;
          }
        },
        empty: function () {},
      });
  
      // After user selects from Awesomplete
      this.inputLine.addEventListener("awesomplete-selectcomplete", () => {
        this.inputLine.value = this.inputLine.value; // lock in
        this.isEditing = true;
        this.validateInput();
      });
    }
  
    /**
     * findRelevantColon(cursorPos):
     * Returns the position of the colon we want to use for param or return type,
     * or -1 if none is found behind the cursor in a place that indicates "typing a type".
     *
     * We do a quick parse:
     * - If user is inside parentheses or just after ), we accept the nearest colon behind them
     *   only if there's no comma or ) between that colon and the cursor.
     */
    findRelevantColon(cursorPos) {
      const line = this.inputLine.value;
      // We'll look for the last colon behind the cursor
      let colPos = line.lastIndexOf(":", cursorPos - 1);
      if (colPos < 0) {
        return -1;
      }
      // Now we check if there's a comma or ) between colPos and cursorPos
      // If there is, that means the user typed "..., blah): something" and
      // we might not want to interpret that colon as the one for param type.
      // But let's do a simpler approach: just accept it if it exists at all.
      // If you want a more advanced approach, you can parse the parentheses.
  
      // For a minimal approach, we just return colPos.
      return colPos;
    }
  
    ////////////////////////////////////////////////////////////////////
    // 2) handleInput(e)
    ////////////////////////////////////////////////////////////////////
    handleInput(e) {
      const val = this.inputLine.value;
      this.isEditing = true;
  
      // If exactly 1 alpha typed in an empty line, auto-prepend "+"
      if (val.length === 1 && /^[a-zA-Z]$/.test(val[0])) {
        this.inputLine.value = "+" + val;
      }
  
      // Red text or normal
      this.validateInput();
  
      // Now let's decide if we should open Awesomplete, close it, or leave it
      const pos = this.inputLine.selectionStart;
      // Are we at a scenario we want to show suggestions?
      const colPos = this.findRelevantColon(pos);
      if (colPos < 0) {
        // No relevant colon => close suggestions
        this.awesomplete.list = [];
        this.awesomplete.close();
        return;
      }
  
      // If we found a relevant colon, let's open/evaluate Awesomplete
      this.awesomplete.list = this.dataTypes;
      this.awesomplete.evaluate();
    }
  
    ////////////////////////////////////////////////////////////////////
    // The rest is the same as your code: updateDisplay, parseOperation, etc.
    ////////////////////////////////////////////////////////////////////
    updateDisplay() {
      this.lines.forEach((l) => (l.textContent = ""));
  
      if (this.currentIndex > 1) {
        this.lines[0].textContent = this.formatOperation(
          this.items[this.currentIndex - 2]
        );
      }
      if (this.currentIndex > 0) {
        this.lines[1].textContent = this.formatOperation(
          this.items[this.currentIndex - 1]
        );
      }
  
      if (this.currentIndex + 1 < this.items.length) {
        this.lines[2].textContent = this.formatOperation(
          this.items[this.currentIndex + 1]
        );
      }
      if (this.currentIndex + 2 < this.items.length) {
        this.lines[3].textContent = this.formatOperation(
          this.items[this.currentIndex + 2]
        );
      }
  
      if (this.items[this.currentIndex]) {
        this.inputLine.value = this.formatOperation(this.items[this.currentIndex]);
      } else {
        this.inputLine.value = "";
      }
      this.validateInput();
    }
  
    isIncomplete() {
      const val = this.inputLine.value.trim();
      if (val === "") {
        return false;
      }
      const regex =
        /^([\+\-\#])[a-zA-Z][a-zA-Z0-9]*\s*\(([^)]*)\)\s*(?::\s*[a-zA-Z][a-zA-Z0-9]*)?$/;
      return !regex.test(val);
    }
  
    formatOperation(op) {
      if (!op) {
        return "";
      }
      const visibilityMap = {
        public: "+",
        protected: "#",
        private: "-",
      };
      const visibility = visibilityMap[op.visibility] || "+";
      const name = op.name || "";
      const params = op.ownedElements
        .filter((el) => el._type === "UMLParameter" && el.direction === 0)
        .map((param) => {
          const paramType = param.type?.className || param.type?.name || "void";
          let multiplicity = param.multiplicity;
          if (multiplicity === "0..1" || !multiplicity) {
            multiplicity = "";
          } else {
            multiplicity = ` [${multiplicity}]`;
          }
          return `${param.name}: ${paramType}${multiplicity}`;
        })
        .join(", ");
      const returnType = op.returnType ? op.returnType.name : "void";
      return `${visibility}${name}(${params}): ${returnType}`;
    }
  
    saveItem() {
      const val = this.inputLine.value.trim();
      if (val === "") {
        return;
      }
      const parsed = this.parseOperation(val);
      if (!parsed) {
        return;
      }
      let operation;
      if (this.items[this.currentIndex]) {
        operation = this.items[this.currentIndex];
        const original = JSON.stringify(operation);
        operation.visibility = parsed.visibility;
        operation.name = parsed.name;
        operation.returnType = { name: parsed.returnType };
        operation.ownedElements = parsed.parameters;
        if (JSON.stringify(operation) !== original) {
          this.onUpdateItem(operation);
        }
      } else {
        operation = {
          _type: "UMLOperation",
          visibility: parsed.visibility,
          name: parsed.name,
          returnType: { name: parsed.returnType },
          ownedElements: parsed.parameters,
        };
        this.items.push(operation);
        this.onNewItem(operation);
      }
      this.isEditing = false;
    }
  
    parseOperation(val) {
      const regex =
        /^([\+\-\#])([a-zA-Z][a-zA-Z0-9]*)\s*\(([^)]*)\)\s*(?::\s*([a-zA-Z][a-zA-Z0-9]*))?$/;
      const match = val.match(regex);
      if (!match) {
        return null;
      }
      const visibilityMap = {
        "+": "public",
        "#": "protected",
        "-": "private",
      };
      const visibility = visibilityMap[match[1]];
      const name = match[2];
      const paramsString = match[3].trim();
      const returnType = match[4] || "void";
  
      const params = [];
      if (paramsString !== "") {
        const paramsArray = paramsString.split(",");
        for (let paramStr of paramsArray) {
          const pMatch = paramStr
            .trim()
            .match(/^([a-zA-Z][a-zA-Z0-9]*)\s*:\s*([a-zA-Z][a-zA-Z0-9]*)(\s*\[(\d+|\d+\.\.\d+|\d+\.\.\*)\])?$/);
          if (!pMatch) {
            return null;
          }
          params.push({
            _type: "UMLParameter",
            name: pMatch[1],
            type: { name: pMatch[2] },
            direction: 0,
            multiplicity: pMatch[4] || "0..1",
          });
        }
      }
  
      return {
        visibility,
        name,
        parameters: params,
        returnType,
      };
    }
  
    removeCurrentItem() {
      if (this.items[this.currentIndex]) {
        const op = this.items[this.currentIndex];
        if (op._id) {
          this.onRemoveItem(op._id);
        }
        this.items.splice(this.currentIndex, 1);
      }
      this.isEditing = false;
    }
  }
  
  //
  // ClassDefEditor merges the ClassHeaderPanel, AttributePanel, and OperationPanel
  //
  export class ClassDefEditor {
    constructor() {
      this.jsonClass = null;
      this.stereotypeList = [];
      this.allDataTypes = [];
      this.position = { x: null, y: null };
      this.modal = null;
      this.container = null;
  
      // Panels
      this.headerPanel = null;
      this.attributePanel = null;
      this.operationPanel = null;
    }
  
    // Public events
    onNameChange(newName) {}
    onStereotypeChange(newStereotype) {}
    onEditorClose() {}
  
    onNewAttribute(attr) {}
    onUpdateAttribute(attr) {}
    onRemoveAttribute(attrId) {}
  
    onNewOperation(op) {}
    onUpdateOperation(op) {}
    onRemoveOperation(opId) {}
  
    setModel(jsonClass) {
      this.jsonClass = jsonClass;
    }
  
    setPosition(x, y) {
      this.position = { x, y };
      if (this.container) {
        this.container.style.left = `${x}px`;
        this.container.style.top = `${y}px`;
        this.container.style.position = "absolute";
      }
    }
  
    async activate() {
      await this.loadDataTypes();
      await this.loadStereotypes();
      this.createModal();
      this.buildPanels();

      // Give focus to the class name input
      if (this.headerPanel && this.headerPanel.nameInput) {
          this.headerPanel.nameInput.focus();
      }      
    }
  
    closeEditor() {
      if (this.modal) {
        document.body.removeChild(this.modal);
        this.modal = null;
        this.onEditorClose();
      }
    }
  
    async loadDataTypes() {
      const dtArray = await metaModel.getDataTypes();
      this.allDataTypes = dtArray.map((dt) => dt.node.name);
    }
  
    async loadStereotypes() {
      const sArray = await metaModel.getStereotypes();
      this.stereotypeList = sArray.map((s) => s.node);
    }
  
    createModal() {
      this.modal = document.createElement("div");
      this.modal.classList.add("attribute-editor-modal");
      document.body.appendChild(this.modal);
  
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) {
          this.closeEditor();
        }
      });
  
      this.container = document.createElement("div");
      this.container.classList.add("attribute-editor-container");
      this.modal.appendChild(this.container);
  
      if (this.position.x !== null && this.position.y !== null) {
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
        this.container.style.position = "absolute";
      } else {
        this.container.classList.add("centered");
      }
  
      this.setupDragging();
    }
  
    buildPanels() {
      // Class header panel
      this.headerPanel = new ClassHeaderPanel(this.jsonClass, this.stereotypeList);
      this.headerPanel.onNameChange = (n) => this.onNameChange(n);
      this.headerPanel.onStereotypeChange = (s) => { this.onStereotypeChange(s); this.attributePanel.inputLine.focus(); };

      const headerEl = this.headerPanel.createPanel();
      // Quick entry: ENTER on class name advances to stereotype...
      const thiz = this;
      this.headerPanel.nameInput.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            thiz.headerPanel.stereotypeSelect.focus();
        }
      });
      // Quick entry: ENTER on stereotype advances to attributes...
      this.headerPanel.stereotypeSelect.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
            thiz.attributePanel.inputLine.focus();
        }
      });
      this.container.appendChild(headerEl);

  
      // Attributes
      const attributes = (this.jsonClass?.ownedElements || []).filter(
        (el) => el._type === "UMLAttribute"
      );
      this.attributePanel = new AttributePanel(attributes);
      this.attributePanel.setDataTypes(this.allDataTypes);
      this.attributePanel.onNewItem = (a) => this.onNewAttribute(a);
      this.attributePanel.onUpdateItem = (a) => this.onUpdateAttribute(a);
      this.attributePanel.onRemoveItem = (id) => this.onRemoveAttribute(id);
      this.attributePanel.onNextEditor = () => {  this.operationPanel.inputLine.focus(); };
      const attrEl = this.attributePanel.createPanel("Attributes");
      this.container.appendChild(attrEl);
      this.attributePanel.updateDisplay();
  
      // Operations
      const operations = (this.jsonClass?.ownedElements || []).filter(
        (el) => el._type === "UMLOperation"
      );
      this.operationPanel = new OperationPanel(operations);
      this.operationPanel.setDataTypes(this.allDataTypes);
      this.operationPanel.onNewItem = (o) => this.onNewOperation(o);
      this.operationPanel.onUpdateItem = (o) => this.onUpdateOperation(o);
      this.operationPanel.onRemoveItem = (id) => this.onRemoveOperation(id);
      this.operationPanel.onNextEditor = () => this.closeEditor();
      const opEl = this.operationPanel.createPanel("Operations");
      this.container.appendChild(opEl);
      this.operationPanel.updateDisplay();
  
      // Bottom close button
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "Close";
      closeBtn.classList.add("attribute-editor-close-button");
      closeBtn.style.marginTop = "15px";
      closeBtn.addEventListener("click", () => {
        this.closeEditor();
      });
      this.container.appendChild(closeBtn);
    }
  
    setupDragging() {
      this.container.style.cursor = "move";
  
      this.container.addEventListener("mousedown", (e) => {
        if (
          e.target.tagName.toLowerCase() === "input" ||
          e.target.tagName.toLowerCase() === "select" ||
          e.target.tagName.toLowerCase() === "button" ||
          e.target.tagName.toLowerCase() === "span"
        ) {
          return;
        }
        e.preventDefault();
        this.isDragging = true;
        this.dragOffset = {
          x: e.clientX - this.container.offsetLeft,
          y: e.clientY - this.container.offsetTop,
        };
  
        document.addEventListener("mousemove", this.handleDrag);
        document.addEventListener("mouseup", this.stopDragging);
      });
    }
  
    handleDrag = (e) => {
      if (!this.isDragging) {
        return;
      }
      e.preventDefault();
  
      let x = e.clientX - this.dragOffset.x;
      let y = e.clientY - this.dragOffset.y;
  
      const maxX = window.innerWidth - this.container.offsetWidth;
      const maxY = window.innerHeight - this.container.offsetHeight;
      x = Math.max(0, Math.min(x, maxX));
      y = Math.max(0, Math.min(y, maxY));
  
      this.container.style.left = `${x}px`;
      this.container.style.top = `${y}px`;
      this.container.style.position = "absolute";
  
      this.position.x = x;
      this.position.y = y;
    };
  
    stopDragging = (e) => {
      if (!this.isDragging) {
        return;
      }
      e.preventDefault();
      this.isDragging = false;
  
      document.removeEventListener("mousemove", this.handleDrag);
      document.removeEventListener("mouseup", this.stopDragging);
    };


    setAttributeId(nameOfAttribute, newMetaId) {
        if (!this.attributePanel || !this.attributePanel.items) {
          return;
        }

        // Find the first UMLAttribute with that name
        const attr = this.attributePanel.items.find(
          (el) => el._type === "UMLAttribute" && el.name === nameOfAttribute
        );
        if (attr) {
          attr._id = newMetaId;
        }
        else {
            console.error('Could not find attribute named ' + nameOfAttribute + ' in model. Ignoring request.');
        }
    }

      
    setOperationId(nameOfOperation, newMetaId) {
        if (!this.operationPanel || !this.operationPanel.items) {
          return;
        }

        // Find the first UMLOperation with that name
        const op = this.operationPanel.items.find(
          (el) => el._type === "UMLOperation" && el.name === nameOfOperation
        );
        if (op) {
          op._id = newMetaId;
        }
        else {
            console.error('Could not find operation named ' + nameOfOperation + ' in model. Ignoring request.');
        }
    }

  }

