#!/bin/bash
# Show some examples for interval handling

function getNext {
    H=$1
    M=$2
    S=$3

    echo -n "$H:$M:$S  "

    MIN=$(( $INTERVAL - (10#$M + 60*10#$H) % $INTERVAL - 1 ))
    if [ $MIN -lt 0 ]; then
        MIN=0
    fi
    SEC=$(( 60 - 10#$S ))
    HRS=$(( ($MIN - $MIN%60)/60 ))
    MIN=$(( $MIN%60 ))
    WAIT=$(( $HRS*60*60 + (MIN)*60 + SEC ))
    printf "%02d:%02d:%02d = %d\n" $HRS $MIN $SEC $WAIT
}

function waitNextQuarterHour {
    MIN=$(( $INTERVAL - (10#$(date +%M) + 60*10#$(date +%H)) % $INTERVAL - 1 ))
    if [ $MIN -lt 0 ]; then
        MIN=0
    fi
    SEC=$(( 60 - 10#$(date +%S) ))
    HRS=$(( ($MIN - $MIN%60)/60 ))
    MIN=$(( $MIN%60 ))
    WAIT=$(( $HRS*60*60 + (MIN)*60 + SEC ))
    printf "Waiting for next ${INTERVAL}min. (%02d:%02d:%02d = %ds)\n" $HRS $MIN $SEC $WAIT
    #sleep $WAIT
    date +"%Y-%m-%d %H:%M:%S"
}

[ -z $INTERVAL ] && INTERVAL=15
waitNextQuarterHour

for INTERVAL in 15 30 60 90 120 360 1440; do
    echo "Interval: $INTERVAL"
    getNext 12 05 09
    getNext 13 05 09
    getNext 05 30 09
    getNext 23 58 55

    waitNextQuarterHour
done
