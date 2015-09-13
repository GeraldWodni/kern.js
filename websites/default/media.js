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

        /* create new folder */
        k.router.post( "/new-folder", function( req, res, next ) {
            k.postman( req, res, function() {
                /* sanitize input */
                var filepath = sanitizePath( req, res, "files" );
                if( filepath == null )
                    return;

                /* create directory */
                fs.mkdir( filepath, function( err ) {
                    if( err )
                        return next( err );
                    console.log( "NEW-folder".bold.yellow, filepath );
                    res.send({success: true});
                });

            });
        });

        /* delete folder */
        k.router.post( "/delete-folder", function( req, res, next ) {
            k.postman( req, res, function() {
                /* sanitize input */
                var filepath = sanitizePath( req, res, "files" );
                if( filepath == null )
                    return;

                /* create directory */
                rmrf( filepath );
                console.log( "Delete-folder".bold.yellow, filepath );
                res.send({success: true});
            });
        });

        /* delete folder */
        k.router.post( "/delete-file", function( req, res, next ) {
            k.postman( req, res, function() {
                /* sanitize input */
                var filepath = sanitizePath( req, res, "files" );
                if( filepath == null )
                    return;

                /* create directory */
                fs.unlink( filepath, function( err ) {
                    if( err )
                        return next( err );

                    console.log( "Delete-file".bold.yellow, filepath );
                    res.send({success: true});
                });
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

        /* uploader expects json */
        k.router.post( "/upload/*", function( req, res, next ) {
            res.send( { success: false } );
        });

        k.router.get( "/", function( req, res, next ) {
            var filePath = k.hierarchy.lookupFile( req.kern.website, "files" );
            readTree( { dirpath: filePath, prefix: "/files" }, function( err, tree ) {
                if( err )
                    console.log( "ERROR".bold.red, err );
                //console.log( util.inspect( tree, { colors: true, depth: null } ) );
                k.jade.render( req, res, "admin/media", k.reg("admin").values( req, { tree: tree } ) );
            });
        });
    }
};
