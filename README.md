# Suomi24 Chat TypeScript Interface

Simple WebSocket & REST interface for interacting with Suomi24's chat channels

# [TypeDoc](https://telaak.github.io/suomi24-ts/index.html)

## Description

This project consists of 4 main parts:

1. The S24 handler, which handles login and state for the site
2. Chat handlers, that connect to given chat channel(s) and emit messages and events to the main handler
3. A WebSocket and REST interface that emits messages and events and can be used to send messages back to the appropriate channel
4. A simple sqlite database that saves all received messages

### WebSocket and HTTP interface

* The address for WebSocket connections is http://localhost:4000/ws/connect
* The address for the HTTP interface is http://localhost:4000/

See the route handlers for more information.


## Getting Started

### Dependencies

* Nodejs 16+ (fetch support)
* Sadly Suomi24's chat is so old that Node has to be run with insecure-http-parser

### Installing

1. Pull the repository `git pull github.com/telaak/suomi24-ts.git`
2. Install all dependencies `npm i`
3. Run the TypeScript compiler `npx tsc`
4. Fill out the required environmental variables:
 * USERNAME (username for the Suomi24 account)
 * PASSWORD (password for the Suomi24 account)
 * ROOM_IDS (comma separated list of numerical room IDs)
 * SQLITE_PATH (path to the sqlite database)
5. Run the main file `node --insecure-http-parser dist/index.js`


### Docker

## Building

* `docker build -t username/suomi24-ts`

## Compose

```
version: '2.3'

services:

  suomi24-daemon:
    image: telaaks/suomi24-ts
    container_name: suomi24-daemon
    restart: unless-stopped
    volumes:
      - /data/sqlite:/app/sqlite/
    environment:
      USERNAME: 
      PASSWORD: 
      ROOM_IDS: 
      SQLITE_PATH: ./sqlite/db.sqlite
```

## License

This project is licensed under the MIT License - see the LICENSE.md file for details
