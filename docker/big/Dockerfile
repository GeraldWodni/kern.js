FROM node:10
MAINTAINER Gerald Wodni <gerald.wodni@gmail.com>

EXPOSE 8000

WORKDIR /usr/src/app
RUN chown -R node:node .

RUN apt-get update; \
    apt-get install -y --no-install-recommends \
        texlive-base \
        texlive-lang-english \
        texlive-lang-german \
        texlive-latex-base \
        texlive-latex-extra \
        texlive-science \
        ; \
    rm -rf /var/lib/apt/lists/*; \

USER node
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
