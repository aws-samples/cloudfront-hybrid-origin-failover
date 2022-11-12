#!/usr/bin/env bash
if [[ $# -ge 1 ]]; then
    echo "---------------------------------------------"
    echo "req# | status | timestamp | statusCode | TTFB"
    echo "---------------------------------------------"
    for ((i=1;i<=300;i++));
    do
    response=`curl --silent --connect-timeout 8 $1 -w "%{http_code} %{time_starttransfer}\n"`
    status_code=`echo $response | awk '{print $9}'`
    TTFB=`echo $response | awk '{print $10}'`
    respBody=`echo $response | awk '{print $5}'`
    if [[ "$status_code" -ge 500 ]] ; then
        echo "$i,DOWN,$(date +"%Y-%m-%d %H:%M:%S"),$status_code"; sleep 1; 
    else
        echo "$i,$respBody,$(date +"%Y-%m-%d %H:%M:%S"),$status_code,$TTFB"; sleep 1; 

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