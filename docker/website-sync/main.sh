#!/bin/bash

LOCK=/tmp/sync.lock
[ -z "$KERNDIR" ] && KERNDIR=/usr/src/app
DIR=$KERNDIR/websites/$WEBSITE
USERFILE=$DIR/users.json

# setup git
git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
git config --global pull.rebase false
git config --global init.defaultBranch main
git config --global safe.directory $DIR

# if repo does not exists clone it
if [ ! -d $DIR/.git ]; then
    echo "Repo does not exist, clone it"
    # remove any ext4 "features"
    rm -rf $DIR/lost+found
    git clone $REPOSITORY $DIR
fi

cd $DIR

# clone private repo if set
if [ -z "$PRIVATE_REPO" ]; then
    echo "No private repo"
elif [ ! -d private/.git ]; then
    echo "Private repo does not exist, clone it"
    git clone $PRIVATE_REPO private
fi

if [ "$CLONE_AND_EXIT" = "true" ]; then
    echo "Clone and exit set, bye bye"
    exit 0
fi

trap terminate SIGHUP SIGINT SIGTERM

function terminate {
    syncRepo "TERM"
    exit 0
}

function printStatus {
    TIME=$(date +"%Y-%m-%d %H:%M:%S")
    echo "$1 $TIME - $2"
}

function indent {
    sed 's/^/    /g'
}

function syncUsers {
    if [ "$SYNC_USERS" != "true" ]; then
        printStatus INFO "Skipping syncUsers (env SYNC_USERS != true)"
        return
    fi

    # avoid startup issues (redis not ready)
    REDIS_REPLY=$(wget -q -O - localhost:$KERN_CLI_PORT/$KERN_CLI_SECRET/user/export/$WEBSITE)
    REDIS_RC=$?
    if [ $REDIS_RC -ne 0 ]; then
        echo "syncUsers wget Error: $REDIS_RC"
        return
    fi

    REDIS_ERROR=$(echo $REDIS_REPLY | jq --raw-output ".error")
    REDIS_MAX_ID=$(echo $REDIS_REPLY | jq --raw-output ".maxId")
    if [ $REDIS_ERROR = "true" ]; then
        printStatus WARN "syncUsers Redis Error: $(echo $REDIS_REPLY | jq --raw-output '.err')"
        return
    fi

    # avoid synching on empty volume
    if [ ! -f $USERFILE ]; then
        printStatus WARN "syncUsers Error: USERFILE does not exist: $USERFILE"
        return
    fi

    # sync from or into redis
    FILE_MAX_ID=$(jq --raw-output ".maxId" $USERFILE)
    printStatus INFO "REDIS_MAX_ID: $REDIS_MAX_ID ,  FILE_MAX_ID: $FILE_MAX_ID"
    if [ $REDIS_MAX_ID = "null" ] || [ $REDIS_MAX_ID -lt $FILE_MAX_ID ]; then
        printStatus INFO "Load users (Redis:$REDIS_MAX_ID < File:$FILE_MAX_ID)"
        wget -q -O - --method POST --body-file $USERFILE localhost:$KERN_CLI_PORT/$KERN_CLI_SECRET/user/import/$WEBSITE/--
    else
        printStatus INFO "Saving users (Redis:$REDIS_MAX_ID >= File:$FILE_MAX_ID)"
        wget -O $USERFILE localhost:$KERN_CLI_PORT/$KERN_CLI_SECRET/user/export/$WEBSITE
    fi
}

if [ "$1" = "syncUsers" ]; then
    printStatus INFO "Sync Users Manual"
    syncUsers
    exit 0
fi

printStatus INFO "User check"
syncUsers

printStatus INFO "Startup completed"

function syncGit {
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
}

function syncRepo {
    if [ "$SYNC_DISABLED" == "true" ]; then
        printStatus INFO "Skipping syncRepo (env SYNC_DISABLED == true)"
        return
    fi

    PREFIX=$1
    if mkdir $LOCK; then
        echo "$PREFIX: Got lock, performing syncRepo"
        COMMIT_MSG=$(date +"Autocommit %Y-%m-%d %H:%M:%S")

        syncGit

        # clone private repo if set
        if [ -z "$PRIVATE_REPO" ]; then
            echo "No private repo to sync"
        elif [ -d private/.git ]; then
            cd private
            syncGit
            cd ..
        fi

        rm -r $LOCK
    else
        printStatus WARN "$PREFIX: cannot acquire lock, syncRepo in progress"
    fi
}

function waitNextQuarterHour {
    MIN=$(( 15 - 10#$(date +%M) % 15 - 1 ))
    if [ $MIN -lt 0 ]; then
        MIN=0
    fi
    SEC=$(( 60 - 10#$(date +%S) ))
    WAIT=$(( (MIN)*60 + SEC ))
    echo "Waiting for next quarter hour ($MIN:$SEC = $WAIT)"
    sleep $WAIT
    date +"%Y-%m-%d %H:%M:%S"
}

syncRepo "STARTUP"

if [ -f $DIR/package.json ]; then
    printStatus INFO "npm install (in website container)"
    wget -q -O - localhost:$KERN_CLI_PORT/$KERN_CLI_SECRET/npm/install/$WEBSITE
else
    printStatus INFO "skip npm install, no package.json"
fi

if [ -f $DIR/bin/startup.sh ]; then
    printStatus INFO "startup (in website-sync container)"
    $DIR/bin/startup.sh
else
    printStatus INFO "skip startup, no bin/startup.sh"
fi

sleep 5m

while true; do
    waitNextQuarterHour
    syncUsers
    syncRepo "INTERVAL"
done

