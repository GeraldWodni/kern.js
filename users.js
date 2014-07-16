// User management
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

module.exports = function( rdb ) {
    var users = {
        add: function( prefix, obj ) {
            var userCounter = prefix + ":users";
            rdb.watch( userCounter );

            var userId = 0;
            var multi = rdb.multi();
            multi.incr( userCounter, function( err, data ) {
                userId = data;
            });

            /* TODO: map object to hset */
            multi.hset( prefix + ":user" + userCounter, obj );
            multi.exec( function( err, replies ) {
                if( err )
                    console.log( "ERROR:", err );

                console.log( "MULTI:", replies );
            });
        }
    };

    rdb.users = users;

    return users;
};
