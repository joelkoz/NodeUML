import { ActiveTool } from "./diagramTools.js";

export class VerticalPusherTool {
    constructor(paper, graph) {
        this.paper = paper;
        this.graph = graph;
        this.isActive = false;
        this.isMouseDown = false;
        this.selectedShapes = [];
        this.lineTrackY = null;
        this.mouseDownY = null;
        this.scrollContainer = document.getElementById('scroll-container');
        this.horizontalLine = null;
        this.direction = null; // 'up' or 'down'
        this.movementThreshold = 4; // Pixels to establish movement direction
        this.pxEdgeDeactivate = 4; // Pixels from edge to deactivate

        // Bind event handlers
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    activate() {
        if (this.isActive) {
            return;
        }

        this.isActive = true;
        this.activatedTime = Date.now();

        // Add event listeners to the document
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('keydown', this.onKeyDown);

        // Initialize the dashed horizontal line
        this.horizontalLine = document.createElement('div');
        this.horizontalLine.style.position = 'absolute';
        this.horizontalLine.style.width = `${this.scrollContainer.scrollWidth}px`;
        this.horizontalLine.style.height = '1px';
        this.horizontalLine.style.backgroundColor = 'transparent';
        this.horizontalLine.style.borderTop = '1px dashed black';
        this.horizontalLine.style.pointerEvents = 'none';
        this.horizontalLine.style.zIndex = '1000'; // Ensure it's on top
        this.scrollContainer.appendChild(this.horizontalLine);
    }

    deactivate(restart = true) {
        if (!this.isActive) {
            return;
        }

        this.isActive = false;

        // Remove event listeners from the document
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('keydown', this.onKeyDown);

        // Remove the horizontal line
        if (this.horizontalLine && this.horizontalLine.parentNode) {
            this.horizontalLine.parentNode.removeChild(this.horizontalLine);
            this.horizontalLine = null;
        }

        if (restart) {
            this.activate();
        } else {
            this.onDeactivate();
        }
    }

    onMouseMove(event) {
        // Get the local point in paper coordinates
        const localPoint = this.paper.clientToLocalPoint(event.clientX, event.clientY);
        const currentMouseY = localPoint.y;

        // Convert the local point back to page coordinates to position the horizontal line
        const clientPoint = this.paper.localToPagePoint(localPoint);

        // Adjust the clientPoint to be relative to the scrollContainer
        const containerRect = this.scrollContainer.getBoundingClientRect();
        const lineY = clientPoint.y - containerRect.top + this.scrollContainer.scrollTop;

        // Edge proximity check
        const leftEdgeDistance = event.clientX - containerRect.left;
        const rightEdgeDistance = containerRect.right - event.clientX;
        const topEdgeDistance = event.clientY - containerRect.top;
        const bottomEdgeDistance = containerRect.bottom - event.clientY;

        if (
            leftEdgeDistance <= this.pxEdgeDeactivate ||
            rightEdgeDistance <= this.pxEdgeDeactivate ||
            topEdgeDistance <= this.pxEdgeDeactivate ||
            bottomEdgeDistance <= this.pxEdgeDeactivate
        ) {
            // Mouse is near the edge, deactivate the tool without restarting
            this.deactivate(false);
            return;
        }

        // Update horizontal line position
        this.horizontalLine.style.top = `${lineY}px`;
        this.horizontalLine.style.left = `${this.scrollContainer.scrollLeft}px`;

        if (this.isMouseDown) {
            // Solid line when mouse is down
            this.horizontalLine.style.borderTop = '1px solid black';

            if (!this.direction) {
                // Establish movement direction
                const deltaY = currentMouseY - this.mouseDownY;
                if (Math.abs(deltaY) >= this.movementThreshold) {
                    this.direction = deltaY > 0 ? 'down' : 'up';
                    this.selectShapes();
                    this.initializeLineTrackY();
                    this.onMoveStarted();
                }
            } else {
                // Move shapes if necessary based on direction
                if (this.direction === 'down' && currentMouseY > this.lineTrackY) {
                    const deltaY = currentMouseY - this.lineTrackY;
                    this.lineTrackY = currentMouseY;
                    this.moveShapes(deltaY);
                } else if (this.direction === 'up' && currentMouseY < this.lineTrackY) {
                    const deltaY = currentMouseY - this.lineTrackY;
                    this.lineTrackY = currentMouseY;
                    this.moveShapes(deltaY);
                }
            }
        } else {
            // Dashed line when mouse is up
            this.horizontalLine.style.borderTop = '1px dashed black';
        }
    }

    onMouseDown(event) {
        const currentTime = Date.now();
        if (currentTime - this.activatedTime < 500) {
            // Mouse down occurred too soon after activation; ignore it
            return;
        }

        // Check if the mouse is within the paper area
        const paperRect = this.paper.el.getBoundingClientRect();
        if (
            event.clientX < paperRect.left ||
            event.clientX > paperRect.right ||
            event.clientY < paperRect.top ||
            event.clientY > paperRect.bottom
        ) {
            // Mouse down occurred outside the paper; ignore it
            return;
        }

        this.isMouseDown = true;
        this.direction = null; // Reset direction

        // Get the local point in paper coordinates
        const localPoint = this.paper.clientToLocalPoint(event.clientX, event.clientY);
        this.mouseDownY = localPoint.y;

        // Change line to solid
        this.horizontalLine.style.borderTop = '1px solid black';
    }

    onMouseUp(event) {
        this.isMouseDown = false;
        if (this.direction) {
            this.onMoveCompleted(); 
        }
        this.deactivate(); // By default, restart is true

    }

    onKeyDown(event) {
        if (event.key === 'Escape' && !this.isMouseDown) {
            this.deactivate(false); // Pass false to not restart
        }
    }

    selectShapes() {
        this.selectedShapes = [];

        // Get the visible area in local coordinates
        const visibleArea = this.getVisibleAreaInLocalCoordinates();

        const elements = this.graph.getElements();

        elements.forEach(cell => {
            const bbox = cell.getBBox();

            // Check if the shape is visible in the scroll-container
            if (this.isElementVisible(bbox, visibleArea)) {
                if (this.direction === 'down') {
                    // For downward movement, select shapes with topY >= mouseDownY
                    if (bbox.y >= this.mouseDownY) {
                        this.selectedShapes.push(cell);
                    }
                } else if (this.direction === 'up') {
                    // For upward movement, select shapes with bottomY <= mouseDownY
                    if ((bbox.y + bbox.height) <= this.mouseDownY) {
                        this.selectedShapes.push(cell);
                    }
                }
            }
        });
    }

    getVisibleAreaInLocalCoordinates() {
        const containerRect = this.scrollContainer.getBoundingClientRect();

        // Client coordinates of the scroll container's corners
        const containerTopLeftClientX = containerRect.left;
        const containerTopLeftClientY = containerRect.top;

        const containerBottomRightClientX = containerRect.right;
        const containerBottomRightClientY = containerRect.bottom;

        // Convert to local coordinates
        const topLeftLocalPoint = this.paper.clientToLocalPoint(containerTopLeftClientX, containerTopLeftClientY);
        const bottomRightLocalPoint = this.paper.clientToLocalPoint(containerBottomRightClientX, containerBottomRightClientY);

        return {
            x: topLeftLocalPoint.x,
            y: topLeftLocalPoint.y,
            width: bottomRightLocalPoint.x - topLeftLocalPoint.x,
            height: bottomRightLocalPoint.y - topLeftLocalPoint.y
        };
    }

    isElementVisible(bbox, visibleArea) {
        // Check if bbox intersects with visibleArea
        const horizontalOverlap = bbox.x + bbox.width > visibleArea.x && bbox.x < visibleArea.x + visibleArea.width;
        const verticalOverlap = bbox.y + bbox.height > visibleArea.y && bbox.y < visibleArea.y + visibleArea.height;
        return horizontalOverlap && verticalOverlap;
    }

    initializeLineTrackY() {
        if (this.selectedShapes.length > 0) {
            if (this.direction === 'down') {
                // For downward movement, set lineTrackY to minimum topY
                this.lineTrackY = Math.min(...this.selectedShapes.map(cell => cell.getBBox().y));
            } else if (this.direction === 'up') {
                // For upward movement, set lineTrackY to maximum bottomY
                this.lineTrackY = Math.max(...this.selectedShapes.map(cell => cell.getBBox().y + cell.getBBox().height));
            }
        } else {
            this.lineTrackY = this.mouseDownY;
        }
    }

    moveShapes(deltaY) {
        this.selectedShapes.forEach(cell => {
            const position = cell.position();
            cell.position(position.x, position.y + deltaY);
        });
    }


    onMoveStarted() {
    }


    onMoveCompleted() {
    }


    onDeactivate() {
        ActiveTool.clear();
    }
}


export class HorizontalPusherTool {
    constructor(paper, graph) {
        this.paper = paper;
        this.graph = graph;
        this.isActive = false;
        this.isMouseDown = false;
        this.selectedShapes = [];
        this.lineTrackX = null;
        this.mouseDownX = null;
        this.scrollContainer = document.getElementById('scroll-container');
        this.verticalLine = null;
        this.direction = null; // 'left' or 'right'
        this.movementThreshold = 4; // Pixels to establish movement direction
        this.pxEdgeDeactivate = 4; // Pixels from edge to deactivate

        // Bind event handlers
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    activate() {
        if (this.isActive) {
            return;
        }

        this.isActive = true;
        this.activatedTime = Date.now();

        // Add event listeners to the document
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('keydown', this.onKeyDown);

        // Initialize the dashed vertical line
        this.verticalLine = document.createElement('div');
        this.verticalLine.style.position = 'absolute';
        this.verticalLine.style.width = '1px';
        this.verticalLine.style.height = `${this.scrollContainer.scrollHeight}px`;
        this.verticalLine.style.backgroundColor = 'transparent';
        this.verticalLine.style.borderLeft = '1px dashed black';
        this.verticalLine.style.pointerEvents = 'none';
        this.verticalLine.style.zIndex = '1000'; // Ensure it's on top
        this.scrollContainer.appendChild(this.verticalLine);
    }

    deactivate(restart = true) {
        if (!this.isActive) {
            return;
        }

        this.isActive = false;

        // Remove event listeners from the document
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('keydown', this.onKeyDown);

        // Remove the vertical line
        if (this.verticalLine && this.verticalLine.parentNode) {
            this.verticalLine.parentNode.removeChild(this.verticalLine);
            this.verticalLine = null;
        }

        if (restart) {
            this.activate();
        } else {
            this.onDeactivate();
        }
    }

    onMouseMove(event) {
        // Get the local point in paper coordinates
        const localPoint = this.paper.clientToLocalPoint(event.clientX, event.clientY);
        const currentMouseX = localPoint.x;

        // Convert the local point back to page coordinates to position the vertical line
        const clientPoint = this.paper.localToPagePoint(localPoint);

        // Adjust the clientPoint to be relative to the scrollContainer
        const containerRect = this.scrollContainer.getBoundingClientRect();
        const lineX = clientPoint.x - containerRect.left + this.scrollContainer.scrollLeft;

        // Edge proximity check
        const leftEdgeDistance = event.clientX - containerRect.left;
        const rightEdgeDistance = containerRect.right - event.clientX;
        const topEdgeDistance = event.clientY - containerRect.top;
        const bottomEdgeDistance = containerRect.bottom - event.clientY;

        if (
            leftEdgeDistance <= this.pxEdgeDeactivate ||
            rightEdgeDistance <= this.pxEdgeDeactivate ||
            topEdgeDistance <= this.pxEdgeDeactivate ||
            bottomEdgeDistance <= this.pxEdgeDeactivate
        ) {
            // Mouse is near the edge, deactivate the tool without restarting
            this.deactivate(false);
            return;
        }

        // Update vertical line position
        this.verticalLine.style.left = `${lineX}px`;
        this.verticalLine.style.top = `${this.scrollContainer.scrollTop}px`;

        if (this.isMouseDown) {
            // Solid line when mouse is down
            this.verticalLine.style.borderLeft = '1px solid black';

            if (!this.direction) {
                // Establish movement direction
                const deltaX = currentMouseX - this.mouseDownX;
                if (Math.abs(deltaX) >= this.movementThreshold) {
                    this.direction = deltaX > 0 ? 'right' : 'left';
                    this.selectShapes();
                    this.initializeLineTrackX();
                    this.onMoveStarted();
                }
            } else {
                // Move shapes if necessary based on direction
                if (this.direction === 'right' && currentMouseX > this.lineTrackX) {
                    const deltaX = currentMouseX - this.lineTrackX;
                    this.lineTrackX = currentMouseX;
                    this.moveShapes(deltaX);
                } else if (this.direction === 'left' && currentMouseX < this.lineTrackX) {
                    const deltaX = currentMouseX - this.lineTrackX;
                    this.lineTrackX = currentMouseX;
                    this.moveShapes(deltaX);
                }
            }
        } else {
            // Dashed line when mouse is up
            this.verticalLine.style.borderLeft = '1px dashed black';
        }
    }

    onMouseDown(event) {
        const currentTime = Date.now();
        if (currentTime - this.activatedTime < 500) {
            // Mouse down occurred too soon after activation; ignore it
            return;
        }


        // Check if the mouse is within the paper area
        const paperRect = this.paper.el.getBoundingClientRect();
        if (
            event.clientX < paperRect.left ||
            event.clientX > paperRect.right ||
            event.clientY < paperRect.top ||
            event.clientY > paperRect.bottom
        ) {
            // Mouse down occurred outside the paper; ignore it
            return;
        }

        this.isMouseDown = true;
        this.direction = null; // Reset direction

        // Get the local point in paper coordinates
        const localPoint = this.paper.clientToLocalPoint(event.clientX, event.clientY);
        this.mouseDownX = localPoint.x;

        // Change line to solid
        this.verticalLine.style.borderLeft = '1px solid black';
    }

    onMouseUp(event) {
        this.isMouseDown = false;
        if (this.direction) {
            this.onMoveCompleted();
        }
        this.deactivate(); // By default, restart is true
    }

    onKeyDown(event) {
        if (event.key === 'Escape' && !this.isMouseDown) {
            this.deactivate(false); // Pass false to not restart
        }
    }

    selectShapes() {
        this.selectedShapes = [];

        // Get the visible area in local coordinates
        const visibleArea = this.getVisibleAreaInLocalCoordinates();

        const elements = this.graph.getElements();

        elements.forEach(cell => {
            const bbox = cell.getBBox();

            // Check if the shape is visible in the scroll-container
            if (this.isElementVisible(bbox, visibleArea)) {
                if (this.direction === 'right') {
                    // For rightward movement, select shapes with leftX >= mouseDownX
                    if (bbox.x >= this.mouseDownX) {
                        this.selectedShapes.push(cell);
                    }
                } else if (this.direction === 'left') {
                    // For leftward movement, select shapes with rightX <= mouseDownX
                    if ((bbox.x + bbox.width) <= this.mouseDownX) {
                        this.selectedShapes.push(cell);
                    }
                }
            }
        });
    }

    getVisibleAreaInLocalCoordinates() {
        const containerRect = this.scrollContainer.getBoundingClientRect();

        // Client coordinates of the scroll container's corners
        const containerTopLeftClientX = containerRect.left;
        const containerTopLeftClientY = containerRect.top;

        const containerBottomRightClientX = containerRect.right;
        const containerBottomRightClientY = containerRect.bottom;

        // Convert to local coordinates
        const topLeftLocalPoint = this.paper.clientToLocalPoint(containerTopLeftClientX, containerTopLeftClientY);
        const bottomRightLocalPoint = this.paper.clientToLocalPoint(containerBottomRightClientX, containerBottomRightClientY);

        return {
            x: topLeftLocalPoint.x,
            y: topLeftLocalPoint.y,
            width: bottomRightLocalPoint.x - topLeftLocalPoint.x,
            height: bottomRightLocalPoint.y - topLeftLocalPoint.y
        };
    }

    isElementVisible(bbox, visibleArea) {
        // Check if bbox intersects with visibleArea
        const horizontalOverlap = bbox.x + bbox.width > visibleArea.x && bbox.x < visibleArea.x + visibleArea.width;
        const verticalOverlap = bbox.y + bbox.height > visibleArea.y && bbox.y < visibleArea.y + visibleArea.height;
        return horizontalOverlap && verticalOverlap;
    }

    initializeLineTrackX() {
        if (this.selectedShapes.length > 0) {
            if (this.direction === 'right') {
                // For rightward movement, set lineTrackX to minimum leftX
                this.lineTrackX = Math.min(...this.selectedShapes.map(cell => cell.getBBox().x));
            } else if (this.direction === 'left') {
                // For leftward movement, set lineTrackX to maximum rightX
                this.lineTrackX = Math.max(...this.selectedShapes.map(cell => cell.getBBox().x + cell.getBBox().width));
            }
        } else {
            this.lineTrackX = this.mouseDownX;
        }
    }

    moveShapes(deltaX) {
        this.selectedShapes.forEach(cell => {
            const position = cell.position();
            cell.position(position.x + deltaX, position.y);
        });
    }


    onMoveStarted() {
    }

    onMoveCompleted() {
    }


    onDeactivate() {
        ActiveTool.clear();
    }
}