// upload and manage media files
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var fs      = require("fs");
var path    = require("path");
var async   = require("async");
var util    = require("util");
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

        /* create new folder */
        k.router.post( "/new-folder", function( req, res, next ) {
            k.postman( req, res, function() {
                /* sanitize input */
                var filename = req.postman.filename("name");
                var websiteRoot = k.hierarchyRoot( req.kern.website );
                var prefix = path.normalize( path.join( websiteRoot, req.postman.link("prefix"), filename ) );

                /* ensure same root */
                if( prefix.indexOf( path.join( websiteRoot, "files" ) ) != 0 )
                    return res.status( 403 ).send({success:false, cracker: true});

                /* create directory */
                fs.mkdir( prefix, function( err ) {
                    if( err )
                        return next( err );
                    console.log( "NEW-folder".bold.yellow, prefix );
                    res.send({success: true});
                });

            });
        });

        k.router.get( "/", function( req, res, next ) {
            var filePath = k.hierarchy.lookupFile( req.kern.website, "files" );
            readTree( { dirpath: filePath, prefix: "/files" }, function( err, tree ) {
                if( err )
                    console.log( "ERROR".bold.red, err );
                console.log( util.inspect( tree, { colors: true, depth: null } ) );
                k.jade.render( req, res, "admin/media", k.reg("admin").values( req, { tree: tree } ) );
            });
        });
    }
};
