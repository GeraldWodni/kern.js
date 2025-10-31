#!/bin/bash

if [ $# -ne 1 ]; then
    echo "Usage: $0 <website>"
    exit 1
fi

WEBSITE=$1
LOCALE=de-AT

KERN_STATIC_LOCALE=$LOCALE
export KERN_STATIC_LOCALE
KERN_STATIC_HOST=$WEBSITE
export KERN_STATIC_HOST
KERN_LOAD_ONLY_HOSTS=$WEBSITE
export KERN_LOAD_ONLY_HOSTS
KERN_AUTO_LOAD=true
export KERN_AUTO_LOAD

npm start

