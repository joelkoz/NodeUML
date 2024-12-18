import { metaModel } from "./metaModel.js";

export class ClassEditorBase {
    constructor() {
      this.jsonClass = null;
      this.items = [];
      this.currentIndex = 0;
      this.modal = null;
      this.container = null;
      this.inputLine = null;
      this.lines = [];
      this.dataTypes = [];
      this.isEditing = false;
      this.position = { x: null, y: null };
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
    }
  
    async activate() {
      await this.loadDataTypes();
      this.createModal();
      this.updateDisplay();
      this.inputLine.focus();
    }
  
    onNewItem(jsonItem) {
      // Placeholder for user-implemented function
      console.log("New Item:", jsonItem);
    }
  
    onUpdateItem(jsonItem) {
      // Placeholder for user-implemented function
      console.log("Updated Item:", jsonItem);
    }
  
    onRemoveItem(metaId) {
      // Placeholder for user-implemented function
      console.log("Removed Item ID:", metaId);
    }
  
    onEditorClose() {
      // Placeholder for user-implemented function
      console.log("Editor Closed");
    }
  
    async loadDataTypes() {
      // Assuming metaModel.getDataTypes() is available globally
      const dataTypes = await metaModel.getDataTypes();
      this.dataTypes = dataTypes.map((dt) => dt.node.name);
    }
  
    setModel(jsonClass) {
      this.jsonClass = jsonClass;
      this.items = this.getItemsFromClass(jsonClass);
      if (this.modal) {
        this.updateDisplay();
      }
    }
  
    getItemsFromClass(jsonClass) {
      // Abstract method to be implemented in derived classes
      throw new Error("getItemsFromClass() must be implemented in derived classes");
    }
  
    setPosition(x, y) {
      this.position = { x, y };
      if (this.container) {
        this.container.style.left = `${x}px`;
        this.container.style.top = `${y}px`;
        this.container.style.position = "absolute";
        this.container.classList.remove("centered");
      }
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
  
      this.setupDragging();
  
      this.lines = [];
      for (let i = 0; i < 5; i++) {
        const line = document.createElement("div");
        line.classList.add("attribute-editor-line");
        this.container.appendChild(line);
        if (i === 2) {
          this.inputLine = document.createElement("input");
          this.inputLine.type = "text";
          this.inputLine.classList.add("attribute-editor-input");
          line.appendChild(this.inputLine);
          this.setupInputEvents();
  
          this.awesomplete = new Awesomplete(this.inputLine, {
            list: [],
            minChars: 0,
            autoFirst: true,
            filter: (text, input) => {
              return this.awesompleteFilter(text, input);
            },
            replace: (text) => {
              this.awesompleteReplace(text);
            },
            empty: function () {},
          });
  
          this.inputLine.addEventListener("awesomplete-selectcomplete", () => {
            this.validateInput();
          });
        } else {
          const label = document.createElement("span");
          label.classList.add("attribute-editor-label");
          line.appendChild(label);
          this.lines.push(label);
        }
      }
  
      const closeButton = document.createElement("button");
      closeButton.textContent = "Close";
      closeButton.classList.add("attribute-editor-close-button");
      this.container.appendChild(closeButton);
      closeButton.addEventListener("click", () => {
        this.closeEditor();
      });
  
      document.addEventListener("keydown", this.handleGlobalKeyDown);
  
      if (this.position.x !== null && this.position.y !== null) {
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
        this.container.style.position = "absolute";
        this.container.classList.remove("centered");
      } else {
        this.container.classList.add("centered");
      }
    }
  
    setupDragging() {
      this.container.style.cursor = "move";
  
      this.container.addEventListener("mousedown", (e) => {
        if (
          e.target.classList.contains("attribute-editor-input") ||
          e.target.classList.contains("attribute-editor-label") ||
          e.target.classList.contains("attribute-editor-close-button") ||
          e.target.tagName.toLowerCase() === "input" ||
          e.target.tagName.toLowerCase() === "button" ||
          e.target.tagName.toLowerCase() === "span"
        ) {
          return;
        }
        e.preventDefault();
        this.isDragging = true;
        this.dragOffset.x = e.clientX - this.container.offsetLeft;
        this.dragOffset.y = e.clientY - this.container.offsetTop;
  
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
  
      this.inputLine.focus();
    };
  
    handleGlobalKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeEditor();
      }
    };
  
    closeEditor() {
      if (this.modal) {
        document.body.removeChild(this.modal);
        this.modal = null;
        this.onEditorClose();
        document.removeEventListener("keydown", this.handleGlobalKeyDown);
      }
    }
  
    updateDisplay() {
      this.lines.forEach((line) => {
        line.textContent = "";
      });
  
      if (this.currentIndex > 1) {
        this.lines[0].textContent = this.formatItem(
          this.items[this.currentIndex - 2]
        );
      }
      if (this.currentIndex > 0) {
        this.lines[1].textContent = this.formatItem(
          this.items[this.currentIndex - 1]
        );
      }
  
      if (this.currentIndex + 1 < this.items.length) {
        this.lines[2].textContent = this.formatItem(
          this.items[this.currentIndex + 1]
        );
      }
      if (this.currentIndex + 2 < this.items.length) {
        this.lines[3].textContent = this.formatItem(
          this.items[this.currentIndex + 2]
        );
      }
  
      if (this.items[this.currentIndex]) {
        const item = this.items[this.currentIndex];
        this.inputLine.value = this.formatItem(item);
      } else {
        this.inputLine.value = "";
      }
  
      this.validateInput();
    }
  
    formatItem(item) {
      throw new Error("formatItem() must be implemented in derived classes");
    }
  
    setupInputEvents() {
      this.inputLine.addEventListener("keydown", (e) => {
        this.handleKeyDown(e);
      });
      this.inputLine.addEventListener("input", (e) => {
        this.handleInput(e);
      });
    }
  
    handleKeyDown(e) {
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
        if (this.awesomplete && this.awesomplete.opened) {
          return;
        }
        e.preventDefault();
        if (
          this.inputLine.value.trim() === "" &&
          this.currentIndex === this.items.length
        ) {
          this.closeEditor();
        } else {
          this.navigateDown();
        }
      } else if (e.key === "Backspace" && this.inputLine.value === "") {
        e.preventDefault();
        this.handleBackspaceOnEmptyLine();
      } else if (e.key === "Delete") {
        e.preventDefault();
        this.deleteItem();
      } else if (
        this.inputLine.selectionStart === 0 &&
        !["+", "-", "#"].includes(e.key) &&
        !/[a-zA-Z]/.test(e.key)
      ) {
        e.preventDefault();
      }
    }
  
    handleInput(e) {
      const value = this.inputLine.value;
      if (value.length === 1 && /[a-zA-Z]/.test(value[0])) {
        this.inputLine.value = "+" + value;
      }
      this.isEditing = true;
  
      this.validateInput();
  
      const lastColonIndex = this.inputLine.value.lastIndexOf(":");
      if (lastColonIndex !== -1) {
        this.awesomplete.list = this.dataTypes;
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
  
    handleBackspaceOnEmptyLine() {
      if (this.isEditing && this.inputLine.value.trim() === "") {
        this.removeCurrentItem();
      }
      if (this.currentIndex > 0) {
        this.currentIndex--;
      }
      this.updateDisplay();
    }
  
    removeCurrentItem() {
      if (this.items[this.currentIndex]) {
        const item = this.items[this.currentIndex];
        if (item._id) {
          this.onRemoveItem(item._id);
        }
        this.items.splice(this.currentIndex, 1);
      }
      this.isEditing = false;
    }
  
    isIncomplete() {
      const value = this.inputLine.value.trim();
      if (value === "") {
        return false;
      }
      return !this.isValidInput(value);
    }
  
    isValidInput(value) {
      throw new Error("isValidInput() must be implemented in derived classes");
    }
  
    saveItem() {
      const value = this.inputLine.value.trim();
      if (value === "") {
        return;
      }
  
      const parsed = this.parseItem(value);
      if (!parsed) {
        return;
      }
  
      let item;
      if (this.items[this.currentIndex]) {
        item = this.items[this.currentIndex];
        const original = JSON.stringify(item);
        this.updateItem(item, parsed);
        if (JSON.stringify(item) !== original) {
          this.onUpdateItem(item);
        }
      } else {
        item = this.createNewItem(parsed);
        this.items.push(item);
        this.onNewItem(item);
      }
      this.isEditing = false;
    }
  
    updateItem(item, parsed) {
      throw new Error("updateItem() must be implemented in derived classes");
    }
  
    createNewItem(parsed) {
      throw new Error("createNewItem() must be implemented in derived classes");
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
  
    parseItem(value) {
      throw new Error("parseItem() must be implemented in derived classes");
    }
  
    awesompleteFilter(text, input) {
      const lastColonIndex = input.lastIndexOf(":");
      if (lastColonIndex === -1) {
        return false;
      } else {
        const typedAfterColon = input.slice(lastColonIndex + 1).trim();
        if (typedAfterColon === "") {
          return true;
        } else {
          return Awesomplete.FILTER_CONTAINS(text, typedAfterColon);
        }
      }
    }
  
    awesompleteReplace(text) {
      const lastColonIndex = this.inputLine.value.lastIndexOf(":");
      this.inputLine.value =
        this.inputLine.value.slice(0, lastColonIndex + 1) + " " + text;
    }
  }
  



  
  export class AttributeEditor extends ClassEditorBase {
    constructor() {
      super();
    }
  
    getItemsFromClass(jsonClass) {
      return jsonClass.ownedElements.filter(
        (el) => el._type === "UMLAttribute"
      );
    }
  
    formatItem(attr) {
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
      const type = attr.type ? attr.type.name : "";
      let multiplicity = attr.multiplicity;
      if (multiplicity === "0..1" || !multiplicity) {
        multiplicity = "";
      } else {
        multiplicity = ` [${multiplicity}]`;
      }
      return `${visibility}${name}: ${type}${multiplicity}`;
    }
  
    isValidInput(value) {
      const regex =
          /^[\+\-\#][a-zA-Z][a-zA-Z0-9]*\s*:\s*[a-zA-Z][a-zA-Z0-9]*(\s*\[(\d+|\d+\.\.\d+|\d+\.\.\*)\])?$/;
      return regex.test(value);
    }
  
    parseItem(value) {
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
        type: match[3].trim(),
        multiplicity: match[5] || "0..1",
      };
    }
  
    updateItem(attribute, parsed) {
      attribute.visibility = parsed.visibility;
      attribute.name = parsed.name;
      attribute.type = { name: parsed.type };
      attribute.multiplicity = parsed.multiplicity;
    }
  
    createNewItem(parsed) {
      return {
        _type: "UMLAttribute",
        visibility: parsed.visibility,
        name: parsed.name,
        type: { name: parsed.type },
        multiplicity: parsed.multiplicity,
      };
    }
  }
  