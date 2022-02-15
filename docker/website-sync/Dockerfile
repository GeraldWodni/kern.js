ARG REG_HOSTNAME
ARG REG_FOLDER
FROM ${REG_HOSTNAME}/${REG_FOLDER}/alpine:3.15
MAINTAINER Gerald Wodni <gerald.wodni@gmail.com>

# install proper wget, default busybox-wget is not capable enough
RUN apk --no-cache add \
    bash \
    openssh-client \
    vim \
    jq \
    wget \
    git

RUN adduser node \
    --home /home/node \
    --disabled-password \
    --uid 1000

WORKDIR /usr/src/app/websites
CMD ["main.sh"]

USER node
COPY main.sh /bin/main.sh
