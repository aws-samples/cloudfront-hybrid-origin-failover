#!/usr/bin/env bash
if [[ $# -ge 1 ]]; then

    for ((i=1;i<=300;i++));
    do
    response=`curl --silent --connect-timeout 8 --output /dev/null "https://d1hz8aptdjgovk.cloudfront.net" -I -w "%{http_code} %{time_starttransfer}\n"`
    status_code=` echo $response | awk '{print $1}'`
    TTFB=` echo $response | awk '{print $2}'`
    if [[ "$status_code" -ge 500 ]] ; then
        echo "$i,DOWN,$(date +"%Y-%m-%d %H:%M:%S")"; sleep 1; 
    else
        echo "$i,$(curl -s $1 | grep -o 'PRIMARY\|SECONDARY'),$(date +"%Y-%m-%d %H:%M:%S"),$TTFB"; sleep 1; 

    fi
    done
    exit $?
else
    echo 1>&2 "###############################################################################"
    echo 1>&2 "Please provide exported CloudFront Distribution URL."
    echo 1>&2 "* Example:   test.sh https://xxxxxxxx.cloudfront.net/prod"
    echo 1>&2 "###############################################################################"
    exit 1
fi