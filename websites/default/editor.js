// editor administration module
// (c)copyright 2017 by Gerald Wodni <gerald.wodni@gmail.com>

var fs          = require("fs");
var path        = require("path");
var pathparse	= require("path-parse");
var rmrf        = require("rmrf");
var _           = require("underscore");

module.exports = {
    setup: function( k ) {

        /* protection filters, TODO: allow overwrite per user-permission */
        var hierarchyFilters = {
            dirShowFilters:  [ /views/g, /css/g, /js/g, /^$|^\/admin\/editor\/edit$/g ],
            fileShowFilters: [ /.*\.css$/g, /.*\.jade$/g, /.*\.js$/g, /.*\.json$/, /.*\.less$/g, /.*\.md$/g ],
            lockWebsite: true
        };

        /* prevent unauthorized access */
        function guardFile( req, res, callback ) {
            var filename = req.params[0];
            var filepath = k.hierarchy.checkFilters( req.kern.website, filename, hierarchyFilters );
            if( filepath == null )
                k.httpStatus( req, res, 403 );
            else
                callback( filename, filepath );
        }

        /* render directory tree & editor */
        function renderAll( req, res, next, values ) {
            k.hierarchy.readHierarchyTree( req.kern.website, ".", _.extend( {}, hierarchyFilters, {
                prefix: "/admin/editor/edit"
            }),
            function( err, tree ) {
                if( err ) return next( err );
                k.jade.render( req, res, "admin/editor", k.reg("admin").values( req, _.extend( { tree: tree }, values ) ) );
            });
        }

        /* create, save and delete files & folders */
        k.router.post("/edit/*", function( req, res, next ) {
            k.postman( req, res, function() {
                var filename = req.params[0];
                var name     = req.postman.text("name");
                var filepath = path.join( filename, name );

                if( req.postman.exists( "create-file" ) ) {
                    /* avoid unauthorized filenames */
                    filepath = k.hierarchy.checkFilename( req.kern.website, filepath, hierarchyFilters );
                    console.log( filepath );
                    if( filepath == null )
                        return k.httpStatus( req, res, 403 );
                    /* write empty file */
                    fs.writeFile( filepath, "", function( err ) {
                        if( err ) return next( err );
                        renderAll( req, res, next );
                    });
                }
                else if( req.postman.exists( "create-dir" ) ) {
                    /* avoid unauthorized filenames */
                    filepath = k.hierarchy.checkDirname( req.kern.website, filepath, hierarchyFilters );
                    if( filepath == null )
                        return k.httpStatus( req, res, 403 );
                    /* create directory: TODO: make mode configurable */
                    fs.mkdir( filepath, function( err ) {
                        renderAll( req, res, next );
                    });
                }
                else if( req.postman.exists( "delete-dir" ) ) {
                    filepath = k.hierarchy.checkDirname( req.kern.website, filepath, hierarchyFilters );
                    rmrf( filepath );
                    renderAll( req, res, next );
                }
                else
                    guardFile( req, res, function( filename, filepath ) {
                        if( req.postman.exists("save") ) {
                            var content = req.postman.raw("content").replace(/\r\n/g, "\n");

                            k.hierarchy.createWriteStream( req.kern.website, filename ).end( content );
                            renderAll( req, res, next, { showEditor: true, filename: filename, content: content } );
                        }
                        else if( req.postman.exists("delete-file") )
                            fs.unlink( filepath, function( err ) {
                                if( err ) return next( err );
                                renderAll( req, res, next, { messages: [ { type: "success", title: req.locales.__("File deleted"), text: filename } ] } );
                            });
                        else
                            return next( new Error( "Unknown editor-edit method" ) );
                    });
            });

        });

        /* edit file */
        k.router.get("/edit/*", function( req, res, next ) {
            guardFile( req, res, function( filename, filepath ) {
                fs.readFile( filepath, function( err, content ) {
                    var contentType = pathparse(filename).ext.replace( /^\./, "" );
                    renderAll( req, res, next, { showEditor: true, filename: filename, contentType: contentType, content: content.toString() } );
                });
            });
        });

        /* no file selected, just render tree */
        k.router.get( "/", function( req, res, next ) {
            renderAll( req, res, next );
        });
    }
};
