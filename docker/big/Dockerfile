ARG REG_HOSTNAME
ARG REG_FOLDER
FROM ${REG_HOSTNAME}/${REG_FOLDER}/node-big:20
MAINTAINER Gerald Wodni <gerald.wodni@gmail.com>

EXPOSE 8000

WORKDIR /usr/src/app
RUN chown -R node:node .

USER node
RUN mkdir cache && mkdir websites

COPY bin bin
COPY misc misc

COPY websites/kern websites/kern

COPY *.json .
# note: npm fails when package-lock.json is not writable :P
COPY --chown=node:node package-lock.json .
RUN npm install

COPY locales locales
COPY *.js .

COPY websites/default websites/default

COPY .foreverignore .

CMD ["npm", "start"]
