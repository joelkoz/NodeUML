import { metaModel } from "./metaModel.js";

export class ClassDefEditor {
    constructor() {
      this.jsonClass = null;
      this.modal = null;
      this.container = null;
      this.nameInput = null;
      this.stereotypeSelect = null;
      this.stereotypeList = [];
      this.position = { x: null, y: null };
      this.isDragging = false;
      this.dragOffset = { x: 0, y: 0 };
    }
  
    setModel(jsonClass) {
      this.jsonClass = jsonClass;
    }
  
    onNameChange(newName) {
      // Implement in user code
      console.log("Name changed:", newName);
    }
  
    onStereotypeChange(newStereotype) {
      // Implement in user code
      console.log("Stereotype changed:", newStereotype);
    }
  
    onEditorClose() {
      // Implement in user code
      console.log("Editor Closed");
    }
  
    async activate() {
      await this.loadStereotypes();
      this.createModal();
    }
  
    closeEditor() {
      if (this.modal) {
        document.body.removeChild(this.modal);
        this.modal = null;
        this.onEditorClose();
      }
    }
  
    async loadStereotypes() {
      const stereotypes = await metaModel.getStereotypes();
      this.stereotypeList = stereotypes.map((entry) => entry.node);
    }
  
    setPosition(x, y) {
      this.position = { x, y };
      if (this.container) {
        this.container.style.left = `${x}px`;
        this.container.style.top = `${y}px`;
        this.container.style.position = "absolute";
      }
    }
  
    createModal() {
      // Create modal overlay
      this.modal = document.createElement("div");
      this.modal.classList.add("attribute-editor-modal");
      document.body.appendChild(this.modal);
  
      // Close on click outside container
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) {
          this.closeEditor();
        }
      });
  
      // Create container
      this.container = document.createElement("div");
      this.container.classList.add("attribute-editor-container");
      this.modal.appendChild(this.container);
  
      // Setup dragging
      this.setupDragging();
  
      // Position if x,y provided
      if (this.position.x !== null && this.position.y !== null) {
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
        this.container.style.position = "absolute";
      } else {
        this.container.classList.add("centered");
      }
  
      // Top "X" to close
      const closeX = document.createElement("span");
      closeX.textContent = "X";
      closeX.style.float = "right";
      closeX.style.cursor = "pointer";
      closeX.addEventListener("click", () => {
        this.closeEditor();
      });
      this.container.appendChild(closeX);
  
      // Class name label + input
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Class Name:";
      nameLabel.style.display = "block";
      this.container.appendChild(nameLabel);
  
      this.nameInput = document.createElement("input");
      this.nameInput.type = "text";
      this.nameInput.value = this.jsonClass?.name || "";
      this.nameInput.classList.add("attribute-editor-input");
      this.nameInput.addEventListener("input", () => {
        this.onNameChange(this.nameInput.value);
      });
      this.container.appendChild(this.nameInput);
  
      // Stereotype label + select
      const stereoLabel = document.createElement("label");
      stereoLabel.textContent = "Stereotype:";
      stereoLabel.style.display = "block";
      stereoLabel.style.marginTop = "10px";
      this.container.appendChild(stereoLabel);
  
      this.stereotypeSelect = document.createElement("select");
      this.stereotypeSelect.classList.add("attribute-editor-input");
  
      // Add "<None>" option
      const noneOption = document.createElement("option");
      noneOption.value = "";
      noneOption.textContent = "<None>";
      this.stereotypeSelect.appendChild(noneOption);
  
      // Add stereotypes from the list
      this.stereotypeList.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st._id;
        opt.textContent = st.name;
        this.stereotypeSelect.appendChild(opt);
      });
  
      // Pre-select if the class has stereotypes[0]
      if (this.jsonClass && this.jsonClass.stereotypes && this.jsonClass.stereotypes[0]) {
        const existingId = this.jsonClass.stereotypes[0]._id;
        this.stereotypeSelect.value = existingId;
      } else {
        this.stereotypeSelect.value = "";
      }
  
      this.stereotypeSelect.addEventListener("change", () => {
        const selectedId = this.stereotypeSelect.value;
        if (selectedId === "") {
          this.onStereotypeChange(null);
        } else {
          const selectedStereotype = this.stereotypeList.find(
            (st) => st._id === selectedId
          );
          this.onStereotypeChange(selectedStereotype || null);
        }
      });
      this.container.appendChild(this.stereotypeSelect);
  
      // "Close" button at bottom
      const closeButton = document.createElement("button");
      closeButton.textContent = "Close";
      closeButton.classList.add("attribute-editor-close-button");
      closeButton.style.marginTop = "15px";
      closeButton.addEventListener("click", () => {
        this.closeEditor();
      });
      this.container.appendChild(closeButton);
    }
  
    setupDragging() {
      this.container.style.cursor = "move";
  
      this.container.addEventListener("mousedown", (e) => {
        // Prevent drag if clicking on interactive elements
        if (
          e.target === this.nameInput ||
          e.target === this.stereotypeSelect ||
          e.target.tagName.toLowerCase() === "button" ||
          e.target.tagName.toLowerCase() === "span" ||
          e.target.tagName.toLowerCase() === "input" ||
          e.target.tagName.toLowerCase() === "select"
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
  
      // Refocus name input for convenience
      this.nameInput.focus();
    };
  }
