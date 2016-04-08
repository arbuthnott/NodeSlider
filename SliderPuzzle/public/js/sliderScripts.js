"use strict";

// add some convenience methods for inheritance
Function.prototype.method = function (methodName, func) {
    this.prototype[methodName] = func;
    return this;
};
Object.create = function (prototypeObj) {
    var F = function () {};
    F.prototype = prototypeObj;
    return new F();
};

// my single, global object, with some initial data
var chrisApp = {
    numRows: 4,
    numCols: 4,
    puzzleSize: 400,
    tiles: [],
    animating: false,
    won: false,
    moves: 0,
    imagePath: "/images/squareMickey.png"
};

// check if we're supposed to customize the image
if (window.location.href.indexOf("/image/") != -1) {
    // grab the image name from the url
    var imageName = window.location.href.substr(window.location.href.indexOf("/image/") + 7);
    var request = new XMLHttpRequest();
	request.onreadystatechange = function() {
		if (request.readyState == 4 && request.status == 200) {
			// get data from request object
            chrisApp.imagePath = request.responseText;
            chrisApp.resetImage();
        }
    };
    var requestedName = $("#imageName").val();
	request.open("GET", "/imageUrl?name=" + imageName, true);
	request.send();
}

/************************************
*   TILE CREATION FOR THE PUZZLE    *
************************************/

// function to create the tile template based on data in chrisApp.
chrisApp.createTileTemplate = function() {
    chrisApp.tile = {
        // contains all non-tile specific stuff
        numRows: chrisApp.numRows,
        numCols : chrisApp.numCols,
        puzzleSize: chrisApp.puzzleSize,
        gutterSize: 4,
        borderSize: 2,
        imagePath: chrisApp.imagePath,
        topGap: chrisApp.topGap,
        leftGap: chrisApp.leftGap,
        getRows: function () { return this.numRows; },
        getCols: function () { return this.numCols; },
        getWidth: function () {
            return (this.puzzleSize - (this.numCols + 1) * this.gutterSize - 2 * this.numCols * this.borderSize) / this.numCols;
        },
        getHeight: function () {
            return (this.puzzleSize - (this.numRows + 1) * this.gutterSize - 2 * this.numRows * this.borderSize) / this.numRows;
        },
        getGutter: function () { return this.gutterSize; },
        getBorder: function () { return this.borderSize; }
    };
};

// a function to create a tile at the given row and column
chrisApp.makeTile = function (row, col) {
    // tile will descend from the template
    var t = Object.create(chrisApp.tile);
    // private access vars, also row and column from the parameters
    var targetRow = row, targetCol = col;
    
    // public methods
    t.getRow = function () { return row; };
    t.getCol = function () { return col; };
    t.getLeft = function () { return (col + 1) * t.getGutter() + col * t.getWidth() + 2 * col * t.getBorder(); };
    t.getTop = function () { return (row + 1) * t.getGutter() + row * t.getHeight() + 2 * row * t.getBorder(); };
    t.setTarget = function (r, c) {
        targetRow = r;
        targetCol = c;
    };
    t.moveTo = function (r, c) { 
        row = r;
        col = c;
    };
    t.moveUp = function () { row -= row <= 0 ? 0 : 1; };
    t.moveDown = function () { row += row >= t.getRows() ? 0 : 1; };
    t.moveLeft = function () { col -= col <= 0 ? 0 : 1; };
    t.moveRight = function () { col += col >= t.getCols() ? 0 : 1; };
    t.isHome = function () { return row == targetRow && col == targetCol; };
    // the getImageTop and getImageLeft methods offset the full-sized image to show the correct portion for this tile.
    t.getImageTop = function () {
        return -1 * ((targetRow + 1) * t.getGutter() + targetRow * t.getHeight() + 2 * targetRow * t.getBorder()) + t.topGap;
    };
    t.getImageLeft = function () {
        return -1 * ((targetCol + 1) * t.getGutter() + targetCol * t.getWidth() + 2 * targetCol * t.getBorder()) + t.leftGap;
    };
    // this method of the returned object produces a ready-to-insert html element.
    t.makeElement = function () {
        var elem = $("<div>");
        elem.attr("class", "tile");
        elem.css({
            left: "" + t.getLeft() + "px",
            top: "" + t.getTop() + "px",
            width: "" + t.getWidth() + "px",
            height: "" + t.getHeight() + "px",
            backgroundColor: "darkgrey",
            backgroundImage: "url(" + t.imagePath + ")",
            backgroundPosition: "" + t.getImageLeft() + "px " + t.getImageTop() + "px",
            backgroundSize: "" + (t.puzzleSize - 2 * t.leftGap) + "px " + (t.puzzleSize - 2 * t.topGap) + "px",
            backgroundRepeat: "no-repeat"
        });
        //elem.html(targetRow * t.getCols() + targetCol); // use this to see cell numbers.
        elem.click(function() { chrisApp.clickedTile(t, elem); });
        
        return elem;
    };
    // return the tile.
    return t;
};

/************************************
*   TILE HANDLING DURING PLAY       *
************************************/

// get tile by position
chrisApp.getTileAt = function (r, c) {
    var idx, tile = null;
    for (idx = 0; idx < chrisApp.tiles.length; idx++) {
        tile = chrisApp.tiles[idx];
        if (tile.getRow() == r && tile.getCol() == c) {
            return tile;
        }
    }
    return null;
};

// event handler for tile clicks
chrisApp.clickedTile = function (tile, elem) {
    // check if this tile is adjacent to the empty tile.
    var canMove = (Math.abs(tile.getRow() - chrisApp.emptyTile.row) + Math.abs(tile.getCol() - chrisApp.emptyTile.col)) == 1;
    if (canMove && !chrisApp.animating) {
        // swap positions with the empty tile.
        var newRow = chrisApp.emptyTile.row;
        var newCol = chrisApp.emptyTile.col;
        chrisApp.emptyTile.row = tile.getRow();
        chrisApp.emptyTile.col = tile.getCol();
        tile.moveTo(newRow, newCol);
        
        // animate the move.
        chrisApp.animating = true;
        $(elem).animate({left: "" + tile.getLeft() + "px", top: "" + tile.getTop() + "px"}, 300, function() {
            chrisApp.redrawPuzzle();
            chrisApp.animating = false;
            chrisApp.moves += 1;
            // CHECK WIN CONDITION!!
            if (chrisApp.checkWin()) {
                chrisApp.won = true;
                chrisApp.showWinOverlay();
            }
        });
    }
};

// display a win overlay
chrisApp.showWinOverlay = function () {
    var overlay = $("<div>"); // a div to contain the complete image
    var message = $("<h2>"); // to contain the win message
    message.css({
        backgroundColor: "beige",
        width: "75%",
        marginLeft: "10%",
        marginTop: "80%",
        border: "6px solid black",
        padding: "3px 8px",
        textAlign: "center"
    });
    message.html("Won in " + chrisApp.moves + " moves!");
    var t = chrisApp.tile;
    overlay.attr("class", "winOverlay");
    overlay.css({
        position: "absolute",
        left: "" + t.gutterSize + "px",
        top: "" + t.gutterSize + "px",
        border: "" + t.borderSize + "px solid black",
        width: "" + (t.puzzleSize - 2 * t.gutterSize - 2 * t.borderSize) + "px",
        height: "" + (t.puzzleSize - 2 * t.gutterSize - 2 * t.borderSize) + "px",
        backgroundColor: "darkgrey",
        backgroundImage: "url(" + t.imagePath + ")",
        backgroundPosition: "" + t.leftGap + "px " + t.topGap + "px",
        backgroundSize: "" + (t.puzzleSize - 2 * t.leftGap) + "px " + (t.puzzleSize - 2 * t.topGap) + "px",
        backgroundRepeat: "no-repeat"
    });
    // clicking the overlay should remove it.
    overlay.click(function() {
        chrisApp.won = false;
        chrisApp.moves = 0;
        chrisApp.shuffle();
        $("#PuzzleDiv").remove(".winOverlay");
    })
    
    // add the elements
    overlay.append(message);
    $("#PuzzleDiv").append(overlay);
};

// function to create the tiles based on data in chrisApp. Also redraws.
chrisApp.createTiles = function() {
    var i, j, newTile;
    chrisApp.moves = 0;
    chrisApp.tiles = []; // get rid of the old ones
    for (i = 0; i < chrisApp.numRows; i++) {
        for (j = 0; j < chrisApp.numCols; j++) {
            if (i < chrisApp.numRows - 1 || j < chrisApp.numCols - 1) {
                newTile = chrisApp.makeTile(i, j);
                chrisApp.tiles.push(newTile);
            }
        }
    }
    // empty tile at the bottom right
    chrisApp.emptyTile = {
        row: chrisApp.numRows - 1,
        col: chrisApp.numCols - 1
    };
    chrisApp.redrawPuzzle();
};

// function to check for win
chrisApp.checkWin = function() {
    var idx, won = true;
    for (idx = 0; idx < chrisApp.tiles.length; idx++) {
        won = won && chrisApp.tiles[idx].isHome();
    }
    return won;
}

// function to shuffle the tiles
chrisApp.shuffle = function() {
    chrisApp.moves = 0;
    var idx, rowIdx, colIdx, tile, temparray = [];
    // put all the tiles into the temparray
    for (idx = 0; idx < chrisApp.tiles.length; idx++) {
        temparray[idx] = chrisApp.tiles[idx];
    }
    // and an empty token
    temparray.push("empty");
    for (rowIdx = 0; rowIdx < chrisApp.numRows; rowIdx++) {
        for (colIdx = 0; colIdx < chrisApp.numCols; colIdx++) {
            // grab a random temparray element and remove it.
            idx = Math.floor(Math.random() * temparray.length);
            tile = temparray[idx];
            if (tile === "empty") {
                chrisApp.emptyTile = {
                    row: rowIdx,
                    col: colIdx
                };
            } else {
                tile.moveTo(rowIdx, colIdx);
            }
            temparray.splice(idx, 1);
        }
    }
    chrisApp.redrawPuzzle();
};

/************************************************
*   PUZZLE REDRAWS / IMAGE-ROW-COLUMN UPDATES   *
************************************************/

// function to recreate tiles in DOM from objects in chrisApp.tiles
chrisApp.redrawPuzzle = function () {
    var idx, puzzle = $("#PuzzleDiv");
    puzzle.empty();
    for (idx = 0; idx < chrisApp.tiles.length; idx++) {
        puzzle.append(chrisApp.tiles[idx].makeElement());
    }
};

// function to update number of rows and columns, and reset the puzzle
chrisApp.updatePuzzle = function (sourceForm) {
    chrisApp.numRows = parseInt($(sourceForm).find("#rows").val());
    chrisApp.numCols = parseInt($(sourceForm).find("#cols").val());
    chrisApp.createTileTemplate();
    chrisApp.createTiles();
    return false;
};

// change the puzzle image based on the image path in input form
chrisApp.changeImage = function () {
    var request = new XMLHttpRequest();
	request.onreadystatechange = function() {
		if (request.readyState == 4 && request.status == 200) {
			// get data from request object
            chrisApp.imagePath = request.responseText;
            chrisApp.resetImage();
        }
    };
    var requestedName = $("#imageName").val();
    $("#subtitle").html(requestedName);
	request.open("GET", "/imageUrl?name=" + requestedName, true);
	request.send();
};

// prepares the ui to handle the size of the current image
chrisApp.resetImage = function () {
    var rawImage = new Image();
    rawImage.onload = function(){
        var ratio = this.width / this.height;
        chrisApp.leftGap = Math.max((chrisApp.puzzleSize - ratio * chrisApp.puzzleSize) / 2, 0);
        chrisApp.topGap = Math.max((chrisApp.puzzleSize - (1 / ratio) * chrisApp.puzzleSize) / 2, 0);
    
        // create new tiles
        chrisApp.createTileTemplate();
        chrisApp.createTiles();
    };
    rawImage.src = chrisApp.imagePath; // to trigger the onload
};

$(document).ready(function() {
    /************************************
    *   SETUP                           *
    ************************************/
    
    // do some work on scaling the used image.
    chrisApp.resetImage();
    
    $("input#rows").val(chrisApp.numRows);
    $("input#cols").val(chrisApp.numCols);
    
    // load image list
    var request = new XMLHttpRequest();
	request.onreadystatechange = function() {
		if (request.readyState == 4 && request.status == 200) {
			// get data from request object
            var imageText = request.responseText;
            var imageArray = JSON.parse(imageText);
            var hintList = $("#imageHints");
            var idx, item;
            // create hint items for matching image names.
            for (idx = 0; idx < imageArray.length; idx++) {
                item = $("<li>");
                item.html(imageArray[idx].name);
                item.click(function () {
                    $("input#imageName").val($(this).html());
                    $("button#imageButton").click();
                });
                hintList.append(item);
            }
		}
	};
	request.open("GET", "/imageList?limit=50", true);
    request.send();
    
    /************************************
    *   ADD EVENT HANDLERS              *
    ************************************/
    
    // catch arrowkey presses to control the puzzle.
    $("body").keypress(function(e) {
        var idx, tile, elem;
        var key = e.which || e.keyCode;
        switch(key) {
            case 37: // left
                if (!chrisApp.won && chrisApp.emptyTile.col < chrisApp.numCols - 1) { // can go left
                    tile = chrisApp.getTileAt(chrisApp.emptyTile.row, chrisApp.emptyTile.col + 1);
                    idx = chrisApp.tiles.indexOf(tile);
                    elem = $(".tile:nth-of-type(" + (idx + 1) + ")");
                    elem.click();
                    e.preventDefault(); // prevent scroll etc
                }
                break;
            case 38: // up
                if (!chrisApp.won && chrisApp.emptyTile.row < chrisApp.numRows - 1) { // can go up
                    tile = chrisApp.getTileAt(chrisApp.emptyTile.row + 1, chrisApp.emptyTile.col);
                    idx = chrisApp.tiles.indexOf(tile);
                    elem = $(".tile:nth-of-type(" + (idx + 1) + ")");
                    elem.click();
                    e.preventDefault(); // prevent scroll etc
                }
                break;
            case 39: // right
                if (!chrisApp.won && chrisApp.emptyTile.col > 0) { // can go right
                    tile = chrisApp.getTileAt(chrisApp.emptyTile.row, chrisApp.emptyTile.col - 1);
                    idx = chrisApp.tiles.indexOf(tile);
                    elem = $(".tile:nth-of-type(" + (idx + 1) + ")");
                    elem.click();
                    e.preventDefault(); // prevent scroll etc
                }
                break;
            case 40: // down
                if (!chrisApp.won && chrisApp.emptyTile.row > 0) { // can go down
                    tile = chrisApp.getTileAt(chrisApp.emptyTile.row - 1, chrisApp.emptyTile.col);
                    idx = chrisApp.tiles.indexOf(tile);
                    elem = $(".tile:nth-of-type(" + (idx + 1) + ")");
                    elem.click();
                    e.preventDefault(); // prevent scroll etc
                }
                break;
            default: return;
        }
    });
    
    // pass focus back to the textbox
    $("#imageButton").focus(function() { 
        $("#imageName").focus();
    });
    
    // display image name hints
    $("#imageName").on("input", function() { 
        var request = new XMLHttpRequest();
        request.onreadystatechange = function() {
            if (request.readyState == 4 && request.status == 200) {
                var imageText = request.responseText;
                var imageArray = JSON.parse(imageText);
                var hintList = $("#imageHints");
                hintList.empty();
                var idx, item;
                for (idx = 0; idx < imageArray.length; idx++) {
                    item = $("<li>");
                    item.html(imageArray[idx].name);
                    hintList.append(item);
                }
            }
        };
        var searchText = $(this).val().toUpperCase();
        request.open("GET", "/imageList?limit=20&search=" + searchText, true);
        request.send();
    }).keydown(function(event) { // use tab or enter for autocomplete
        if (event.which == 9) { // tab key
            // autocomplete to first element in hint list, if any
            var hints = $("#imageHints").children();
            if (hints.length > 0) {
                $("#imageName").val(hints[0].textContent);
            }
        } else if (event.which == 13) { // enter key
            $("#imageButton").click();
        }
    });
});

// whew!