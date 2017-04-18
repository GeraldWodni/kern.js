// editor administration module
// (c)copyright 2017 by Gerald Wodni <gerald.wodni@gmail.com>

var _           = require("underscore");

module.exports = {
    setup: function( k ) {

        var hierarchyFilters = {
            dirShowFilters:  [ /views/g, /css/g, /js/g, /^$|^\/admin\/editor\/edit$/g ],
            fileShowFilters: [ /.*\.css$/g, /.*\.jade$/g, /.*\.js$/g, /.*\.json$/, /.*\.less$/g, /.*\.md$/g ],
            lockWebsite: true
        };

        function renderAll( req, res, values ) {
            k.hierarchy.readHierarchyTree( req.kern.website, ".", _.extend( {}, hierarchyFilters, {
                prefix: "/admin/editor/edit"
            }),
            function( err, tree ) {
                k.jade.render( req, res, "admin/editor", _.extend( { tree: tree }, values ) );
            });
        }

        k.router.get("/edit/*", function( req, res ) {
            var filename = req.params[0];
            if( !k.hierarchy.checkFilters( req.kern.website, filename, hierarchyFilters ) )
                return k.httpStatus( req, res, 403 );

            /* read file into string */
            var rs = k.hierarchy.createReadStream( req.kern.website, filename );
            var chunks = [];
            rs.on("data", function( data ) {
                chunks.push( data );
            });
            rs.on("end", function() {
                renderAll( req, res, { content: Buffer.concat( chunks ).toString() } );
            });
        });

        k.router.get( "/", function( req, res ) {
            renderAll( req, res );
        });
    }
};
