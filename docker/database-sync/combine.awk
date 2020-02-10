# MySQL dump insert combiner
# (c)copyright 2020 by Gerald Wodni<gerlad.wodni@gmail.com>
# When versioning MySQL dumps, they are easier to maintain with single row INSERTs
# However replying theese dumps takes forver, so this awk script combines them back into multi row INSERTs

# INSERTING: ensures trailing semicolon
# MAXINSERTS: number of rows to combine
# INSERTTABLE: only combine inserts between CREATE TABLE and UNLOCK TABLES to avoid conflicts with stored procedures
BEGIN { INSERTING=0; MAXINSERTS=500; FS="`"; OFS=""; INSERTTABLE=0 }
/^CREATE TABLE `/ { TABLE=$2; NEWTABLE=1; INSERTCOUNT=0; INSERTTABLE=1 }
/^UNLOCK TABLES/ { INSERTTABLE=0 }
/^INSERT INTO/ {
    if( INSERTTABLE == 1 ) {
        VALUESSTART=index($0," VALUES ") + length(" VALUES ");
        VALUES=substr($0, VALUESSTART, length($0)-VALUESSTART)
        if( INSERTCOUNT % MAXINSERTS == 0 ) {
            # terminate last INSERT
            if( NEWTABLE == 0 )
                print ";";
            print "INSERT INTO `" TABLE "` VALUES " VALUES;
            NEWTABLE = 0;
        }
        else
            print ", " VALUES;

        INSERTING=1;
        INSERTCOUNT=INSERTCOUNT+1
    }
    else
        print $0;
    next;
}
/^) ENGINE=/ {
    sub(/CHARSET=utf8;/, "CHARSET=utf8mb4;", $0)
    print $0
    next;
}
# print any other line
{
    # ensure trailing semicolon
    if ( INSERTING == 1 ) {
        print ";";
        INSERTING = 0;
    }
    print $0
}
END { "-- Combiner done" }
