This repository is forked from https://github.com/0xProject/0x-launch-kit-frontend

## Table of contents

-   [Introduction](#introduction)
-   [Getting started](#getting-started)
-   [Client for your relayers API](#client-for-your-relayers-api)
-   [Commands](#commands)
-   [Database](#database)
-   [Deployment](#deployment)

## Introduction

Autonio Smartdex backend runs as a forked version of 0x relayer

## Getting started

#### Pre-requirements

-   [Node.js](https://nodejs.org/en/download/) > v8.x
-   [Yarn](https://yarnpkg.com/en/) > v1.x

To develop the project, follow the following instructions:

1. Fork this repository

2. Clone your fork of this repository

3. Open the `config.ts`/`config.js` file and edit the whitelisted tokens

4. Open the `.env` file and edit the following fields. Defaults are defined in `config.ts`/`config.js`. The bash environment takes precedence over the `.env` file. If you run `source .env`, changes to the `.env` file will have no effect until you unset the colliding variables.

    - `NETWORK_ID` -- the network you'd like your relayer to run on
    - `FEE_RECIPIENT` -- The Ethereum address which should be specified as the fee recipient in orders your relayer accepts. Defaults to a fake address that helps the 0x core team use anonymous, already public data to understand Launch Kit developer usage.
    - `MAKER_FEE_ZRX_UNIT_AMOUNT` -- The flat maker fee you'd like to receive for filled orders hosted by you
    - `TAKER_FEE_ZRX_UNIT_AMOUNT` -- The flat taker fee you'd like to receive for filled orders hosted by you.
    - `RPC_URL` -- Update with your node url. NOTE: Kovan doesn't work on INFURA with the current version of the OrderWatcher
    
    
[Instructions for using Launch Kit with Ganache](https://hackmd.io/-rC79gYWRyG7h6M9jUf5qA)

5. Make sure you have [Yarn](https://yarnpkg.com/en/) installed.

6. Install the dependencies:

    ```sh
    yarn
    ```

7. Build the project [This step is for Typescript users only]

    ```sh
    yarn build:ts
    ```

    or build & watch:

    ```sh
    yarn watch:ts
    ```

8. Start the backend

    ```sh
    yarn start:ts
    ```

    OR

    ```sh
    yarn start:js
    ```

## Client for your backend APIs

To quickly check if your backend (relayer) is up-and-running, send it this CURL request from the command-line:

```sh
curl http://localhost:3000/v2/orders
```

If everything is working as expected, you should see a similar response:

```
{
    "total": 0,
    "page": 0,
    "perPage": 20,
    "records": []
}
```

Since no orders have been added to your backend yet, the `records` array is empty.

## Commands

Typescript project commands:

-   `yarn build:ts` - Build the code
-   `yarn lint:ts` - Lint the code
-   `yarn start:ts` - Starts the backend
-   `yarn watch:ts` - Watch the source code and rebuild on change
-   `yarn prettier:ts` - Auto-format the code

Javascript project commands:

-   `yarn start:js` - Start the backend
-   `yarn prettier:js` - Auto-format the code

## Database

This project uses [TypeORM](https://github.com/typeorm/typeorm). It makes it easier for anyone to switch out the backing database used by this project. By default, this project uses an [SQLite](https://sqlite.org/docs.html) database.

Because we want to support both Javascript and Typescript codebases, we don't use `TypeORM`'s [decorators](https://github.com/typeorm/typeorm/blob/master/docs/decorator-reference.md) (since they don't transpile nicely into readable Javascript). TypeORM shines with decorators however, so you might want to use them if you're going to be working in Typescript.

## Deployment

The project also comes with a docker container, to build project using docker:

```sh
docker build -t 0x-launch-kit .
```

You can check that the image was built by running:

```sh
docker images
```

And launch it with

```sh
docker run -p 3000:3000 -d 0x-launch-kit
```

Check that it's working by running

```
curl http://localhost:3000/v2/asset_pairs
```

