ARG REG_HOSTNAME
ARG REG_FOLDER
FROM ${REG_HOSTNAME}/${REG_FOLDER}/alpine:3.20
MAINTAINER Gerald Wodni <gerald.wodni@gmail.com>

RUN apk --no-cache add \
    bash \
    mysql-client \
    mariadb-connector-c \
    openssh-client \
    vim \
    git

RUN adduser worker \
    --home /home/worker \
    --disabled-password \
    --uid 1000

WORKDIR /mysql-dumps

USER worker
COPY main.sh /bin/main.sh
COPY combine.awk /home/worker/combine.awk

CMD ["main.sh"]
