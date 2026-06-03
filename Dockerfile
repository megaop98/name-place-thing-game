FROM node:18

RUN useradd -m -u 1000 user
USER user

ENV HOME=/home/user
ENV PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

COPY --chown=user package*.json ./

RUN npm install

COPY --chown=user . .

ENV PORT=7860
EXPOSE 7860

CMD ["npm", "start"]
