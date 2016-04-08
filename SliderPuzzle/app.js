var express = require('express');
var app = express();
var fs = require("fs"); // for file services.
var sqlite3 = require("sqlite3").verbose();
var db;
var multer = require('multer');
var upload = multer({ dest: 'tempUploads/' });

// catches and redirects urls for specific image names
app.get(/^\/image\/\w+/, function(req, res) {
    console.log("recieved request for specific image");	
    res.sendFile('index.html', {root: 'public'});
});

// return a list of image objects containing name and file path
// may be filtered by search term, and limited by size.
app.get('/imageList', function(req, res) {
    console.log("recieved request for imagelist");
    res.type('json');
    var limit = req.query.limit ? parseInt(req.query.limit) : 20;
    var search = req.query.search ? req.query.search.toUpperCase() : "";
    
    var images = [];
    
    // try to populate images array from a database.
    db = new sqlite3.Database("sqlite/sliderdb.sqlite");
    var query = "SELECT name, file FROM imagedata ";
    query += search ? "WHERE name LIKE '%" + search + "%' LIMIT " + limit : "LIMIT " + limit;
    db.serialize(function() {
        db.each(query, function(err, row) {
            images.push({name: row.name, file: row.file});
        }, function(err, affectedRows) {
            res.status(200);
            res.send(JSON.stringify(images));
        });
        
    });
    db.close();
    
    // populate images array from the filenames found in the images folder.
//    fs.readdir("public/images", function(err, items) {
//        for (var i=0; i<items.length; i++) {
//            images.push({name:items[i].substring(0, items[i].indexOf(".")), file: items[i]});
//        }
//        
//        var returnList;
//    
//        // do filtering
//        if (search != "") {
//            var idx = 0;
//            returnList = [];
//            while (returnList.length < limit && idx < images.length) {
//                if (images[idx].name.toUpperCase().indexOf(search) != -1) {
//                    returnList.push(images[idx]);
//                }
//                idx++;
//            }
//        } else {
//            returnList = images.slice(0, limit);
//        }
//    
//        res.status(200);
//        res.send(JSON.stringify(returnList));
//    });
});

// return the image url for the requested name
app.get('/imageUrl', function(req, res) {
    console.log("recieved request for an image filepath");
    res.type('text');
    var name = req.query.name ? req.query.name : "";
    
    // get it from the database!
    var query = "SELECT file FROM imagedata WHERE name LIKE '" + name + "'";
    db = new sqlite3.Database("sqlite/sliderdb.sqlite");
    db.get(query, function(err, row) {
        var file = row ? row.file : "default.png";
        res.status(200);
        res.send('/images/' + file);
    });
    db.close();
    
    // derive from the filenames in the folder
    // var images = [];
//    fs.readdir("public/images", function(err, items) {
//        for (var i=0; i<items.length; i++) {
//            images.push({name:items[i].substring(0, items[i].indexOf(".")), file: items[i]});
//        }
//        
//        var found = false;
//        for (var idx = 0; idx < images.length; idx++) {
//            if (images[idx].name == name) {
//                res.status(200);
//                res.send('images/' + images[idx].file);
//                found = true;
//            }
//        }
//        if (!found) {
//            // send a default filename
//            res.send('images/default.png');
//        }
//    });
});

// upload an image!  Afterward, redirect to url for that image.
app.post('/uploadImage', upload.single('uploadFile'), function(req, res, next) {
    res.type("json");
    
    console.log(req.file);
    console.log(req.files);
    console.log(req.body);
    
    var filename = req.file.originalname;
    var imagename = req.body.uploadName;
    db = new sqlite3.Database("sqlite/sliderdb.sqlite");
    db.serialize(function() {
        // check if filename is unused, and if not then replace
        db.get("SELECT file FROM imagedata WHERE file LIKE '" + filename + "'", function(err, row) {
            if (row != undefined) { // this filename already exists.
                filename = req.file.filename; // use the generated filename.
            }
            // check if name is unused, and if not then replace
            db.get("SELECT name FROM imagedata WHERE name LIKE '" + imagename + "'", function(err, row) {
                if (row != undefined) { // this image name already exists
                    imagename = imagename + Math.floor(Math.random() * 1000); // add a random numeric suffix
                }
                // save a database record
                db.run("INSERT INTO imagedata (name, file) VALUES ('" + imagename + "', '" + filename + "')", function(err, lastid) {
                    if (err) { console.log("Insertion error: " + err) }
                    else {
                        // move the image.
                        fs.rename(req.file.path, __dirname + '/public/images/' + filename, function(err) {
                            if (err) { console.log("file rename error: " + err); }
                            db.close();
                            // send to the new url.
                            res.redirect("/image/" + imagename);
                        });
                    }
                })
            });
        });
    });
    
    
});

// static serve the public directory
app.use(express.static(__dirname + "/public"));

// turn it on!
app.listen(3000, function() {
    console.log("Serving on Port 3000");
});
