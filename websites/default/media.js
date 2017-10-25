// upload and manage media files
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var fs      = require("fs");
var path    = require("path");
var async   = require("async");
var util    = require("util");
var rmrf    = require("rmrf");
var multer  = require("multer");
var _       = require("underscore");

module.exports = {
    setup: function( k ) {

        /* protection filters, TODO: allow overwrite per user-permission */
        var hierarchyFilters = {
            dirShowFilters:  [ /.*/g ],
            fileShowFilters: [ /.*/g ],
            lockWebsite: true
        };

        function readTree( opts, callback ) {
            var tree = { dirs: {}, files: [] };

            /* queue worker */
            var treeQueue = async.queue( function( task, next ) {

                /* directory contents */
                fs.readdir( task.dirpath, function( err, filenames ) {
                    if( err )
                        return next( err );

                    /* run stat for content */
                    async.mapSeries( filenames, function( filename, d ) {
                        var filepath = path.join( task.dirpath, filename );
                        fs.stat( filepath, function( err, stat ) {
                            if( err )
                                return d( err );

                            /* spawn new worker for every directory */
                            if( stat.isDirectory() ) {
                                var prefix = path.join( task.prefix, filename ); 
                                var newTree = { dirs: {}, files: [], prefix: task.prefix, path: prefix };
                                task.tree.dirs[ filename ] = newTree;
                                treeQueue.push( { dirpath: filepath, tree: newTree, prefix: prefix } );
                            }
                            /* just add file */
                            else {
                                var link = path.join( task.prefix, filename );
                                task.tree.files.push( { name: filename, link: link } );
                            }
                            d();
                        });
                    }, next );
                });
            });

            /* all done, callback */
            treeQueue.drain = function( err ) {
                callback( err, tree );
            };
            treeQueue.push( { dirpath: opts.dirpath, tree: tree, prefix: opts.prefix } );
        }

        function sanitizePath( req, res, directoryPrefix ) {
            /* get link or compose of prefix and name */
            var link;
            if( req.postman.exists("link") )
                link = req.postman.link("link");
            else {
                var filename = req.postman.filename("name");
                var prefix = req.postman.link("prefix");
                link = path.join( prefix, filename );
            }

            /* get real paths */
            var websiteRoot = k.hierarchyRoot( req.kern.website );
            var filepath = path.normalize( path.join( websiteRoot, link ) );

            /* ensure same root */
            if( filepath.indexOf( path.join( websiteRoot, directoryPrefix ) ) != 0 ) {
                res.status( 403 ).send({success:false, cracker: true});
                return null;
            }

            return filepath;
        }

        k.router.post("/*", function( req, res, next ) {
            console.log( "POST" );
            k.postman( req, res, function() {
                var filename = req.params[0];
                var name     = req.postman.text("name");
                var filepath = path.join( "media", filename, name );

                if( req.postman.exists( "create-dir" ) ) {
                    filepath = k.hierarchy.checkDirname( req.kern.website, filepath, hierarchyFilters );
                    if( filepath == null )
                        return k.httpStatus( req, res, 403 );
                    console.log( "CREATE-DIR", filepath );
                    fs.mkdir( filepath, function( err ) {
                        if( err ) return next( err );
                        renderAll( req, res, next );
                    });
                }
                else if( req.postman.exists( "delete-dir" ) ) {
                    filepath = k.hierarchy.checkDirname( req.kern.website, filepath, hierarchyFilters );
                    rmrf( filepath );
                    res.redirect( 301, path.dirname( path.join( "/admin/media", req.path ) ) );
                }
                else if( req.postman.exists( "delete-file" ) ) {
                    filepath = path.join( filepath, req.postman.filename( "delete-file" ) );
                    filepath = k.hierarchy.checkDirname( req.kern.website, filepath, hierarchyFilters );
                    fs.unlink( filepath, ( err ) => {
                        if( err ) return next( err );
                        renderAll( req, res, next );
                    });
                }
                else
                    return next( new Error( "Unknown POST-action" ) );
            });
        });

        /* upload */
        /* TODO: fix for new multer-API */
        //k.router.use("/upload/*", multer({
        //    /* change target directory */
        //    changeDest: function _upload_changeDest( dest, req, res ) {
        //        var pathname = req.params[0];
        //        if( pathname.indexOf( "files/" ) != 0 ) {
        //            res.status( 403 ).send({success:false, cracker: true});
        //            return false;
        //        }
        //        return k.hierarchy.lookupFile( req.kern.website, pathname )
        //    },
        //    /* rename special chars */
        //    rename: function _upload_rename( fieldname, filename, req, res ) {
        //        return k.filters.renameFile( filename );
        //    }
        //}));

        /* render directory tree & files */
        function renderAll( req, res, next, values ) {
            k.hierarchy.readHierarchyTree( req.kern.website, "media", _.extend( {}, hierarchyFilters, {
                prefix: "/"
            }),
            function( err, tree ) {
                if( err ) return next( err );
                //console.log( "TREE", tree );

                var currentPath = req.path;
                var node = tree;
                console.log( "CURRENT-PATH:", currentPath );

                /* get files in current folder */
                if( currentPath != "/" ) {
                    try {
                        req.path.substr(1).split("/").forEach( ( part ) => {
                            if( !node || !node.dirs || !node.dirs[ part ] )
                                throw new Error( "Unknown Path" );
                            node = node.dirs[ part ];
                        });
                    } catch( err ) {
                        return next( err );
                    }
                }

                var currentFiles = [];
                node.files.forEach( function( file ) {
                    console.log( file );
                    file.extension = path.extname( file.name );
                    currentFiles.push( file );
                });

                k.jade.render( req, res, "admin/media", k.reg("admin").values( req, _.extend( {
                    tree: tree,
                    currentPath: currentPath,
                    currentFiles: currentFiles
                }, values ) ) );
            });
        }

        /* uploader expects json */
        k.router.post( "/upload/*", function( req, res, next ) {
            res.send( { success: false } );
        });

        k.router.get( "/*", function( req, res, next ) {
            renderAll( req, res, next );
        });
    }
};
