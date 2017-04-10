// jade caching and rendering
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var jade    = require("jade");
var fs      = require("fs");
var path    = require("path");
var os      = require("os");
var moment  = require("moment");
var marked  = require("marked");
var _       = require("underscore");

module.exports = function _jade( k, opts ) {

    var jadeCache = {};

    /* TODO: make cache Website-aware! (login.jade:flink vs. login.jade:echo) */
    function renderJade( req, res, filename, locals, opts ) {

        opts = opts || {};
        /* allow website override */
        var website = req.kern.website;
        if( opts.website )
            website = opts.website;

        console.log( "Render: ".grey, website.green, filename.cyan );

        /* compile template */
        var filepath = k.hierarchy.lookupFile( website, path.join( k.kernOpts.viewFolder, filename + '.jade' ) );
        if( !filepath ) {
            var message = "Unable to locate view " + filename + " in " + website;
            res.status(500).end( message );
            throw new Error( message.bold.red );
        }

        locals = _.extend( locals || {}, {
            __: req.locales.__,
            __locale: req.locales,
            _: _,
            moment: moment,
            marked: marked,
            hostname: os.hostname()
        });

	/* TODO: make this a permanent member of above locals */
	if( path.parse )
            locals._filename = path.parse(filepath).name;

        if( filepath in jadeCache ) {
            console.log( "Jade Cachehit ".grey, filename.cyan, website.grey );
            return res.send( jadeCache[ filepath ]( locals ) );
        }


        _.extend( opts, {
            filename: filepath,
            kernWebsite: website,
            pretty: k.siteConfig.get( website, "jadePrettyPrint", true )
        } );

        fs.readFile( filepath, 'utf8', function( err, data ) {
            if( err ) {
                console.log( err );
                res.send("ERROR: " + err );
                return;
            }

            /* store dependencies */
            var dependencies = [ filepath ];
            /* override jade's resolvePath to use kern-hierarchy */
            jade.Parser.prototype.resolvePath = function (filename, purpose) {
                var callerFile = this.filename;
                var callerDir = path.dirname( callerFile.substring( callerFile.lastIndexOf( '/views/' ) + '/views/'.length ) );

                /* only append jade to non-suffixed includes */
                if( filename.indexOf(".") < 2 )
                    filename = filename + ".jade";

                var file = k.hierarchy.lookupFileThrow( this.options.kernWebsite, path.join( k.kernOpts.viewFolder, path.join( callerDir, filename ) ) );
                dependencies.push( file );
                return file;
            };

            /* compile (synced) */
            var compiledJade = jade.compile( data, opts );

            /* store in cache */
            if( k.kernOpts.cacheJade ) {
                jadeCache[ filepath ] = compiledJade;

                dependencies = _.uniq( dependencies );

                /* remove from cache on dependency change */
                var watchers = [];
                dependencies.forEach( function( filename ) {
                    var watcher = fs.watch( filename, function() {
                        console.log( "Jade Changed".grey, filepath.yellow, website.grey );
                        delete jadeCache[ filepath ];

                        /* close all watchers for root file */
                        watchers.forEach( function( watcher ) { watcher.close() } );
                    });
                    watchers.push( watcher );
                });
            }

            var html = compiledJade( locals );
            console.log( "Jade Rendered ".grey, filename.green, website.grey );
            res.send( html );
        });
    };

    return {
        render: renderJade
    }
}
