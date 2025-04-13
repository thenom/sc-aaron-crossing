#!/bin/bash

podman run -it --rm -p 8080:80 -v $(pwd)/src:/usr/share/nginx/html:ro,Z public.ecr.aws/nginx/nginx:latest
