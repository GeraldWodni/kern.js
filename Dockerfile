FROM node:10
MAINTAINER Gerald Wodni <gerald.wodni@gmail.com>

RUN useradd -d /usr/src/app kernjs
EXPOSE 8000

WORKDIR /usr/src/app
RUN chown -R kernjs:kernjs .

USER kernjs
RUN mkdir cache && mkdir websites

COPY bin bin
COPY misc misc

COPY websites/kern websites/kern

COPY *.json .
RUN npm install

COPY locales locales
COPY *.js .

COPY websites/default websites/default

CMD ["npm", "start"]
