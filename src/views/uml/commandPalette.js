const svgDependency = `
  <line x1="15" y1="40" x2="55" y2="20" stroke="black" stroke-width="2"/>
  <polygon points="57,16 67,21 57,26" fill="black" transform="rotate(-28,55,25)"/>
  <text x="40" y="55" font-family="Arial" font-size="11" text-anchor="middle" fill="black">
    Dependency
  </text>
`;


const svgAssociation = `
  <polyline points="15,20 30,20 30,35 55,35" stroke="black" stroke-width="2" fill="none"/>
  <text x="40" y="55" font-family="Arial" font-size="11" text-anchor="middle" fill="black">
    Association
  </text>
`;


const svgGeneralization = `
  <line x1="40" y1="15" x2="40" y2="45" stroke="black" stroke-width="2"/>
  <polygon points="35,15 40,5 45,15" fill="white" stroke="black" stroke-width="1"/>
  <text x="40" y="55" font-family="Arial" font-size="11" text-anchor="middle" fill="black">
    Generalization
  </text>
</svg>
`;

const svgClass = `
  <rect x="0" y="0" width="80" height="30" fill="#cfcd8a" stroke="black" stroke-width="1"/>
  <text x="40" y="23" font-family="Arial" font-size="10" text-anchor="middle" font-weight="bold" fill="black">
    New Class
  </text>
  <rect x="0" y="30" width="80" height="20" fill="#faf9ac" stroke="black" stroke-width="1"/>
  <rect x="0" y="50" width="80" height="10" fill="#faf9ac" stroke="black" stroke-width="1"/>
`;


const svgEntity = `
  <rect x="0" y="0" width="80" height="30" fill="#cfcd8a" stroke="black" stroke-width="1"/>
  <text x="40" y="12" font-family="Arial" font-size="8" text-anchor="middle" font-style="italic" fill="black">
    &lt;&lt;entity&gt;&gt;
  </text>
  <text x="40" y="25" font-family="Arial" font-size="10" text-anchor="middle" font-weight="bold" fill="black">
    New Entity
  </text>
  <rect x="0" y="30" width="80" height="20" fill="#faf9ac" stroke="black" stroke-width="1"/>
  <rect x="0" y="50" width="80" height="10" fill="#faf9ac" stroke="black" stroke-width="1"/>
`;

const svgService = `
  <rect x="0" y="0" width="80" height="30" fill="#cfcd8a" stroke="black" stroke-width="1"/>
  <text x="40" y="12" font-family="Arial" font-size="8" text-anchor="middle" font-style="italic" fill="black">
    &lt;&lt;service&gt;&gt;
  </text>
  <text x="40" y="25" font-family="Arial" font-size="10" text-anchor="middle" font-weight="bold" fill="black">
    New Service
  </text>
  <rect x="0" y="30" width="80" height="20" fill="#faf9ac" stroke="black" stroke-width="1"/>
  <rect x="0" y="50" width="80" height="10" fill="#faf9ac" stroke="black" stroke-width="1"/>
`;


const svgActor = `
  <circle cx="40" cy="17" r="4.5" stroke="black" stroke-width="2" fill="white"/>
  <line x1="40" y1="21.5" x2="40" y2="32" stroke="black" stroke-width="2"/>
  <line x1="32" y1="26" x2="48" y2="26" stroke="black" stroke-width="2"/>
  <line x1="40" y1="32" x2="33" y2="45" stroke="black" stroke-width="2"/>
  <line x1="40" y1="32" x2="47" y2="45" stroke="black" stroke-width="2"/>
  <text x="40" y="55" font-family="Arial" font-size="11" text-anchor="middle" fill="black">
    New Actor
  </text>
`;

const svgUser = `
  <circle cx="40" cy="17" r="4.5" stroke="black" stroke-width="2" fill="white"/>
  <line x1="40" y1="21.5" x2="40" y2="32" stroke="black" stroke-width="2"/>
  <line x1="32" y1="26" x2="48" y2="26" stroke="black" stroke-width="2"/>
  <line x1="40" y1="32" x2="33" y2="45" stroke="black" stroke-width="2"/>
  <line x1="40" y1="32" x2="47" y2="45" stroke="black" stroke-width="2"/>
  <text x="40" y="55" font-family="Arial" font-size="11" text-anchor="middle" fill="black">
    User
  </text>
`;


const svgAdmin = `
  <circle cx="40" cy="17" r="4.5" stroke="black" stroke-width="2" fill="white"/>
  <line x1="40" y1="21.5" x2="40" y2="32" stroke="black" stroke-width="2"/>
  <line x1="32" y1="26" x2="48" y2="26" stroke="black" stroke-width="2"/>
  <line x1="40" y1="32" x2="33" y2="45" stroke="black" stroke-width="2"/>
  <line x1="40" y1="32" x2="47" y2="45" stroke="black" stroke-width="2"/>
  <text x="40" y="55" font-family="Arial" font-size="11" text-anchor="middle" fill="black">
    Admin Role
  </text>
`;

const svgVerticalPush = `
  <rect x="10" y="31" width="60" height="10" fill="#d3d3d3" stroke="black" stroke-width="1"/>
  <rect x="35" y="11" width="10" height="20" fill="black" rx="2" ry="2"/>
  <line x1="40" y1="31" x2="40" y2="31" stroke="black" stroke-width="2"/>
  <text x="40" y="55" font-family="Arial" font-size="11" text-anchor="middle" fill="black">
    Vertical Push
  </text>
`;


const svgHorizontalPush = `
  <rect x="32" y="5" width="8" height="40" fill="#d3d3d3" stroke="black" stroke-width="1"/>
  <rect x="20" y="20" width="12" height="8" fill="black" rx="2" ry="2"/>
  <line x1="32" y1="25" x2="32" y2="25" stroke="black" stroke-width="2"/>
  <text x="40" y="55" font-family="Arial" font-size="11" text-anchor="middle" fill="black">
    Horizontal Push
  </text>
`;


class CommandPalette {
  constructor(options = {}) {
      this.commands = options.commands || [];
      this.columnCount = options.columnCount || 3;
      this.container = document.getElementById('uml-toolbox');

      this.init(); // Initialize the palette
  }

  init() {
      this.createPalette();
      this.createActiveToolBox(); // Initialize the active tool box
  }

  createPalette() {
      // Create the palette container
      this.palette = document.createElement('div');
      this.palette.classList.add('command-palette');

      // Create the minimized rectangle
      this.paletteMinimized = document.createElement('div');
      this.paletteMinimized.classList.add('command-palette-minimized');
      this.paletteMinimized.textContent = 'tools';

      // Append the minimized box to the palette
      this.palette.appendChild(this.paletteMinimized);

      // Create the expanded content (initially hidden)
      this.paletteExpanded = document.createElement('div');
      this.paletteExpanded.classList.add('command-palette-expanded');
      this.paletteExpanded.style.gridTemplateColumns = `repeat(${this.columnCount}, auto)`;

      // Add buttons or placeholders to the expanded palette
      this.commands.forEach((cmd) => {
          let gridItem;

          if (cmd.svg) {
              // Create a button with the SVG icon
              gridItem = document.createElement('div');
              gridItem.classList.add('command-button-wrapper');
              const buttonSvg = this.getButtonSvg(cmd.svg);
              gridItem.innerHTML = buttonSvg;

              // Get the SVG element with class 'command-button-svg'
              const svgElement = gridItem.querySelector('svg.command-button-svg');

              // Attach event listeners for button animation
              gridItem.addEventListener('mousedown', () => {
                  svgElement.classList.add('button-pressed');
              });

              gridItem.addEventListener('mouseup', () => {
                  svgElement.classList.remove('button-pressed');
                  // Delay execution by 100ms
                  setTimeout(() => {
                      cmd.exec();
                      this.collapsePalette();
                  }, 100);
              });

              // Handle case where mouse leaves the button while pressed
              gridItem.addEventListener('mouseleave', () => {
                  svgElement.classList.remove('button-pressed');
              });
          } else {
              // Create an empty placeholder
              gridItem = document.createElement('div');
              gridItem.classList.add('command-placeholder');
          }

          // Append the grid item (button or placeholder) to the expanded palette
          this.paletteExpanded.appendChild(gridItem);
      });

      this.palette.appendChild(this.paletteExpanded);

      // Attach event listeners for hover behavior
      this.paletteMinimized.addEventListener('mouseenter', () => this.expandPalette());
      this.palette.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));

      // Set initial state for the expanded palette
      this.paletteExpanded.classList.remove('active'); // Ensure it's not active

      this.container.appendChild(this.palette);
  }

  createActiveToolBox() {
      // Create the active tool box container
      this.activeToolBox = document.createElement('div');
      this.activeToolBox.classList.add('active-tool-box');

      // Initially empty
      this.setActiveTool(null);

      // Append it to the body for fixed positioning
      document.body.appendChild(this.activeToolBox);
  }

  setActiveTool(svgIcon) {
      if (svgIcon) {
          // Create the SVG content
          const svgContent = this.getActiveToolSvg(svgIcon);

          // Set the innerHTML of the active tool box
          this.activeToolBox.innerHTML = svgContent;
      } else {
          // Display a blank area with solid background
          this.activeToolBox.innerHTML = `
          <svg class="active-tool-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60" width="60" height="45">
              <!-- Background rectangle with solid fill -->
              <rect width="80" height="60" fill="#ccc" stroke="#999" stroke-width="1" />
          </svg>
          `;
      }
  }

  getActiveToolSvg(svgIcon) {
      return `
      <svg class="active-tool-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60" width="60" height="45">
          <!-- Background rectangle with solid fill -->
          <rect width="80" height="60" fill="#ccc" stroke="#999" stroke-width="1" />
          ${svgIcon}
      </svg>
      `;
  }

  expandPalette() {
      // Hide minimized content
      this.paletteMinimized.style.visibility = 'hidden';
      // Show expanded content by adding 'active' class
      this.paletteExpanded.classList.add('active');
  }

  collapsePalette() {
      // Show minimized content
      this.paletteMinimized.style.visibility = 'visible';
      // Hide expanded content by removing 'active' class
      this.paletteExpanded.classList.remove('active');
  }

  handleMouseLeave(e) {
      // Check if the mouse has left the entire palette
      if (!this.palette.contains(e.relatedTarget)) {
          this.collapsePalette();
      }
  }

  getButtonSvg(svgIcon) {
      return `
      <svg class="command-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 105 85" width="105" height="85">
          <rect x="5" y="5" width="95" height="75" rx="10" ry="10" fill="#c8c8c1" stroke="black" stroke-width="1" filter="url(#shadow)"/>
          <rect x="10" y="10" width="80" height="60" rx="7" ry="7" fill="#d3d3d3" stroke-width="0"/>
          <svg x="10" y="10" viewBox="0 0 80 60" width="80" height="60">
              ${svgIcon}
          </svg>
          <defs>
              <filter id="shadow" x="0" y="0" width="150%" height="150%">
                  <feOffset result="offOut" in="SourceAlpha" dx="2" dy="2"/>
                  <feGaussianBlur result="blurOut" in="offOut" stdDeviation="2"/>
                  <feBlend in="SourceGraphic" in2="blurOut" mode="normal"/>
              </filter>
          </defs>
      </svg>
      `;
  }
}
