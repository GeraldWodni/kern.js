#!/bin/bash

LOCK=/tmp/sync.lock

CONFIG_FILE=$HOME/my.cnf
COMBINE_AWK=$HOME/combine.awk
DATABASE=$MARIADB_DATABASE
DUMPDIR=/mysql-dumps
DUMPFILE=$DUMPDIR/$DATABASE.sql
DUMPFILE_COMBINED=$DUMPDIR/$DATABASE-combined.sql
AUTO_SETUP=$DUMPDIR/autosetup.sh

[ -z $SYNC_INTERVAL ] && SYNC_INTERVAL=60

# setup git
git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"

# if repo does not exists clone it
if [ ! -d $DUMPDIR/.git ]; then
    echo "Repo does not exist, clone it"
    # remove any ext4 "features"
    rm -rf $DUMPDIR/lost+found
    git clone $REPOSITORY $DUMPDIR
fi

trap terminate SIGHUP SIGINT SIGTERM

function terminate {
    syncRepo "TERM" "performDump"
    exit 0
}

function printStatus {
    TIME=$(date +"%Y-%m-%d %H:%M:%S")
    echo "$1 $TIME - $2"
}

function indent {
    sed 's/^/    /g'
}

cat > $CONFIG_FILE <<EOF
[mysql]
user=$MARIADB_DUMPER_USER
password=$MARIADB_DUMPER_PASSWORD
database=$DATABASE
protocol=TCP

[mysqldump]
user=$MARIADB_DUMPER_USER
password=$MARIADB_DUMPER_PASSWORD
protocol=TCP
EOF

while true; do
    DATABASE_EXISTS=$(mysql --defaults-file=$CONFIG_FILE -e "SHOW DATABASES" --silent | grep $DATABASE | wc -l)
    if [ $DATABASE_EXISTS -eq 1 ]; then
        printStatus INFO "Database connection okay"
        break
    else
        printStatus WARN "No connection to database, retrying in 5s"
        sleep 5
    fi
done

DATABASE_TABLES=$(mysql --defaults-file=$CONFIG_FILE -e "SHOW TABLES" --silent | wc -l)
if [ $DATABASE_TABLES -lt 3 ]; then
    printStatus INFO "No Tables in Database"
    # CHECK if dump exists
    if [ -f $DUMPFILE ]; then
        cd $DUMPDIR
        printStatus INFO "Updating $DATABASE CHARACTER SET to utf8mb4, disabling  STRICT_TRANS_TABLES"
        mysql --defaults-file=$CONFIG_FILE -e "ALTER DATABASE $DATABASE CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_general_ci'" --silent
        # disable warnings as errors (remove STRICT_TRANS_TABLES):
        mysql --defaults-file=$CONFIG_FILE -e "SET GLOBAL sql_mode = 'ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION'" --silent

        # combine INSERTs
        printStatus INFO "Combining Dumpfile"
        awk -f $COMBINE_AWK $DUMPFILE > $DUMPFILE_COMBINED

        printStatus INFO "Importing Dumpfile"
        mysql --defaults-file=$CONFIG_FILE < $DUMPFILE_COMBINED
        rm -f $DUMPFILE_COMBINED
    else
        if [ -f $AUTO_SETUP ]; then
            cd $DUMPDIR
            printStatus INFO "Performing AutoSetup"
            $AUTO_SETUP $CONFIG_FILE
        else
            printStatus ERROR "Autosetup not found: $AUTO_SETUP"
        fi
    fi
fi

printStatus INFO "sql_mode: disabling STRICT_TRANS_TABLES"
mysql --defaults-file=$CONFIG_FILE -e "SET GLOBAL sql_mode = 'ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION'" --silent

cd $DUMPDIR

printStatus INFO "Startup completed"

# dump command, DATABASE gets substituted
function performDump {
    mysqldump --defaults-file=$CONFIG_FILE \
    --skip-opt \
    --add-drop-table \
    --add-locks \
    --create-options \
    --disable-keys \
    --lock-tables \
    --quick \
    --set-charset \
    --skip-dump-date \
    --skip-comments \
    --databases $DATABASE \
    --routines \
    --triggers \
    --events \
    > $DUMPFILE
}

function syncRepo {
    PREFIX=$1
    ACTION=$2

    case $ACTION in
        performDump)
            printStatus INFO "Performing Dump"
            performDump
            ;;
        noDump)
            printStatus INFO "Skipping Dump"
            ;;
        *)
            printStatus ERROR "Unknown Action $ACTION"
            ;;
    esac

    if mkdir $LOCK; then
        echo "$PREFIX: Got lock, performing syncRepo"
        COMMIT_MSG=$(date +"Autocommit %Y-%m-%d %H:%M:%S")
        # ... git commit & push
        if git remote update &> /dev/null; then
            UPSTREAM='@{u}' #'
            LOCAL=$(git rev-parse @)
            REMOTE=$(git rev-parse "$UPSTREAM")
            BASE=$(git merge-base @ "$UPSTREAM")

            # local changes? create commit
            CHANGES=$(git status -s | wc -l)
            if [ $CHANGES -eq 0 ]; then
                printStatus INFO "No local changes"
            else
                printStatus INFO "Local changes, commit required ($CHANGES changes)"
                git add .
                git commit -am "$COMMIT_MSG" 2>&1 | indent
            fi

            # remote changes? pull
            if [ "$LOCAL" = "$BASE" ] && [ "$REMOTE" != "$LOCAL" ]; then
                printStatus INFO "Pull required"
                if git pull -X theirs 2>&1 | indent; then
                    printStatus INFO "Pull completed"
                else
                    printStatus ERROR "Pull failed"
                    return
                fi
            fi

            if [ "$LOCAL" != "$REMOTE" ] || [ $CHANGES -gt 0 ]; then
                printStatus INFO "Push required"
                if git push 2>&1 | indent; then
                    printStatus INFO "Push completed"
                else
                    printStatus ERROR "Push failed"
                fi
            fi

        else
            printStatus WARN "No connection to git repo"
        fi
        rm -r $LOCK
    else
        printStatus WARN "$PREFIX: cannot acquire lock, syncRepo in progress"
    fi
}

function waitNextInterval {
    MIN=$(( $SYNC_INTERVAL - (10#$(date +%M) + 60*10#$(date +%H)) % $SYNC_INTERVAL - 1 ))
    if [ $MIN -lt 0 ]; then
        MIN=0
    fi
    SEC=$(( 60 - 10#$(date +%S) ))
    HRS=$(( ($MIN - $MIN%60)/60 ))
    MIN=$(( $MIN%60 ))
    WAIT=$(( $HRS*60*60 + (MIN)*60 + SEC ))
    printf "Waiting for next ${SYNC_INTERVAL}min. (%02d:%02d:%02d = %ds)\n" $HRS $MIN $SEC $WAIT
    sleep $WAIT
    date +"%Y-%m-%d %H:%M:%S"
}

syncRepo "STARTUP" "noDump"
sleep 5m

while true; do
    waitNextInterval
    syncRepo "INTERVAL" "performDump"
done

