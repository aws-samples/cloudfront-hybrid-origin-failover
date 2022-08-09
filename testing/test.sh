#!/usr/bin/env bash
if [[ $# -ge 1 ]]; then
    for ((i=1;i<=100;i++)); do echo $i; curl -s --write-out "time_total: %{time_total} // http_code: %{http_code} " $1 | grep -o 'PRIMARY\|SECONDARY'; echo -n " @ "; date +"%Y-%m-%d %H:%M:%S"; sleep 1; done
    exit $?
else
    echo 1>&2 "###############################################################################"
    echo 1>&2 "Please provide exported Cloudfront Distribution URL."
    echo 1>&2 "* Example:   test.sh https://xxxxxxxx.cloudfront.net/prod"
    echo 1>&2 "###############################################################################"
    exit 1
fi