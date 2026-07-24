---
title: 'Hacky Holidays 2022: “Port Authority,” a WebSocket Game'
description: 'Deloitte’s Hacky Holidays 2022 event featured “Port Authority,” a WebSocket strategy game that challenges you to dock a chaotic port full of ships.'
date: 2022-07-27
tags: ['ctf', 'ppc']
banner:
  light: './assets/banner-light.webp'
  dark: './assets/banner-dark.webp'
authors: ['enscribe']
---

## Introduction

This challenge was part of the Deloitte Hackazon Hacky Holidays "Unlock the City" 2022 CTF (yeah, what a name!). Labeled under the `#ppc` category, which apparently stands for "professional programming challenge", it was the final challenge under the "District 1" segment of the CTF and categorized under the Hard difficulty.

This was the first CTF problem which didn't just challenge my ability to critically think and problem solve - it also challenged my **motor control** and **hand-eye coordination**. Why? _Because I solved it by hand!_ I believe this challenge was meant to be solved using 100% programming, but I wanted to challenge myself. This was the process.

## Port Authority

<challenge-info>
<dl>
<div><dt>Solvers</dt><dd><a href="https://github.com/blueset"><img src="https://github.com/blueset.png" alt="" width="16" height="16" />blueset</a>, <a href="https://github.com/jktrn"><img src="https://github.com/jktrn.png" alt="" width="16" height="16" />enscribe</a>, <a href="https://github.com/sahuang"><img src="https://github.com/sahuang.png" alt="" width="16" height="16" />sahuang</a></dd></div>
<div><dt>Authors</dt><dd>Luuk Hofman, Diederik Bakker</dd></div>
<div><dt>Category</dt><dd>

`PPC`

</dd></div>
<div><dt>Points</dt><dd>5/5 = 350</dd></div>
</dl>

The harbour is in total chaos, the ships are no longer on course. The AI has
disabled the brakes of all the ships and corrupted our control systems. The
ships about to crash into each other, can you build a new AI that will rescue
the ships and deliver the cargo?

</challenge-info>

:::note
  This is an **instance-based** challenge. No website URL will be
  provided!
:::

### Initial inspection & interaction

We're initially provided with a link that takes us to a nice-looking webgame called the "Port Traffic Control Interface":

![Initial Website](./assets/initial-website.gif)

Although we can't directly interact with the game using keyboard controls, there's a manual on the top-right which details the task:

![Manual Website](./assets/manual-website.png)

According to this, we can start playing the game and controlling the ships that appear through a [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/) connection, which is an API that enables two-way communication between a user's browser and a server. [This documentation](https://javascript.info/websocket) describes the protocol alongside how to open/close and send/receive using JavaScript.

Heavily referencing the aforementioned documentation, I started off by installing the WebSocket package with `npm i ws`, and then creating a `solve.js{:file}` with the following code:

~~~js title="`solve.js{:file}`"
// Make sure you install WebSocket with "npm i ws"!
const WebSocket = require('ws')
// Regex so that I can freely paste the URL when the instance is changed
const url = 'https://[REDACTED].challenge.hackazon.org/'
// Opens WebSocket connection
const socket = new WebSocket(`wss://${url.replace(/^https?:\/\//, '')}ws`)

// Runs on socket open, equivalent to .addEventListener()
socket.onopen = function () {
  console.log('[+] Connected!')
  // Converts object to string
  socket.send(
    JSON.stringify({
      type: 'START_GAME',
      level: 1,
    }),
  )
}

// Runs when output from server is received
socket.onmessage = function (event) {
  // Output is received in event
  console.log(`[-] ${event.data}`)
}
~~~

Look what happens when we establish a connection - the game starts running, and we start receiving per-tick input from the server in our console:

![Start Website](./assets/start-website.gif)

```ansi
[0;36m$[0m node test.js
[+] Connected!
[-] {"type":"GAME_START","level":{"id":1,"board":{"width":1886,"height":1188,"obstructions":[{"type":"HARBOUR_BORDER","area":[{"x":577,"y":0},{"x":627,"y":215.7142857142857}]},{"type":"HARBOUR_BORDER","area":[{"x":875,"y":0},{"x":925,"y":215.7142857142857}]},{"type":"BORDER_ROCK","area":[{"x":0,"y":0},{"x":577,"y":51}]},{"type":"BORDER_ROCK","area":[{"x":925,"y":0},{"x":1886,"y":51}]}],"harbour":[{"x":700,"y":0},{"x":850,"y":107.85714285714285}]},"mechanics":{"borderCollision":false,"sequentialDocking":true},"ships":[null]}}
[-] {"type":"TICK","ships":[{"type":"SHIP_6","area":[{"x":472,"y":795},{"x":532,"y":1063.75}],"direction":"UP","speed":3,"id":0,"isDocked":false}]}
[-] {"type":"TICK","ships":[{"type":"SHIP_6","area":[{"x":472,"y":795},{"x":532,"y":1063.75}],"direction":"UP","speed":3,"id":0,"isDocked":false}]}
[-] {"type":"TICK","ships":[{"type":"SHIP_6","area":[{"x":472,"y":792},{"x":532,"y":1060.75}],"direction":"UP","speed":3,"id":0,"isDocked":false}]}
[-] {"type":"TICK","ships":[{"type":"SHIP_6","area":[{"x":472,"y":789},{"x":532,"y":1057.75}],"direction":"UP","speed":3,"id":0,"isDocked":false}]}
...
```

Let's see what happens when we send the `SHIP_STEER` command to the server after five seconds. We can do that with the [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout) method in our `socket.onopen` listener:

~~~js title="`solve.js{:file}`" ins={7-13} startLineNumber=9
socket.onopen = function() {
    console.log("[+] Connected!");
    // Converts object to string
    socket.send(JSON.stringify({
        "type": "START_GAME",
        "level": 1
    }));
    // Sends steer command after one second
    setTimeout(() => {
        socket.send(JSON.stringify({
            "type": "SHIP_STEER",
            "shipId": 0
        }));
    }, 5000);
};
~~~

![First Turn](./assets/first-turn.gif)

From the provided GIF, we can see that the ship will turn clockwise on its central point when told to steer!

With this, we have a goal: **get the ship into the port by sending JSON instructions to the WebSocket server**. However, it's definitely a good idea to create some quality-of-life features first, such as:

- A way to convert our JSON data into an object we can reference
- A class which can construct objects for each ship
- An HTML/JS "controller", which can be used to steer the ships with UI and to start new levels

Firstly, cleaning up the output involves parsing what we receive from the server, which we can do with the `JSON.parse()` method. We'll assign it into a variable named `obj` (and also delete our steer-testing code):

~~~js title="`solve.js{:file}`" ins={14-15} del={1-8} startLineNumber=16
// Sends steer command after one second
    setTimeout(() => {
        socket.send(JSON.stringify({
            "type": "SHIP_STEER",
            "shipId": 0
        }));
    }, 5000);
};

// Runs when output from server is received
socket.onmessage = function(event) {
    // Output is received in event
    console.log(`[-] ${event.data}`);
    // Converts server output into object
    let obj = JSON.parse(event.data);
};
~~~

Each tick, `obj` will change to an object structured this way:

```json
{
  "type": "TICK",
  "ships": [
    {
      "type": "SHIP_6",
      "area": [
        {
          "x": 472,
          "y": 795
        },
        {
          "x": 532,
          "y": 1063.75
        }
      ],
      "direction": "UP",
      "speed": 3,
      "id": 0,
      "isDocked": false
    }
  ]
}
```

Check out the `obj.type{:js}` key - there'll be multiple types of these (including but not limited to `"LOSS"{:js}`, `"GAME_START"{:js}`). We'll make it so that if `obj.type{:js}` is `"TICK"{:js}`, it will create a new `Class{:js}` instance for each object in the `obj.ships{:js}` array:

~~~js title="`solve.js{:file}`" ins={1-15,21-31} startLineNumber=18
class Ship {
    // Initializes class object instance
    constructor(id, topLeft, bottomRight, direction) {
        this.id = id;
        this.topLeft = topLeft;
        this.bottomRight = bottomRight;
        this.direction = direction;
    }
    // Getter + abusing template literals
    get printState() {
        return `ID: ${this.id} | (${Math.floor(this.topLeft.x)}, 
${Math.floor(this.topLeft.y)}) (${Math.floor(this.bottomRight.x)}, 
${Math.floor(this.bottomRight.y)}) | DIR: ${this.direction}`;
    }
}

// Runs when output from server is received
socket.onmessage = function(event) {
    // Converts server output into object
    let obj = JSON.parse(event.data);
    if(obj.type == "TICK") {
        let ships = [];
        // For each ship in obj.ships, push class object into ships array
        for(const i of obj.ships) {
            ships.push(new Ship(i.id, i.area[0], i.area[1], i.direction));
        }
        // Call the string literal getter
        for(const i of ships) {
            console.log(i.printState);
        }
    }
};
~~~

With this new Class, we can get both our own `ships` array _and_ really clean logging from the server:

```ansi
[0;36m$[0m node test.js
[+] Connected!
ID: 0 | (211, 256) (271, 524) | DIR: UP
ID: 0 | (211, 256) (271, 524) | DIR: UP
ID: 0 | (211, 252) (271, 520) | DIR: UP
ID: 0 | (211, 248) (271, 516) | DIR: UP
...
```

Let's finally get to solving the challenge. I'll use subposts to break down each level.

<style>
challenge-info {
  --row-border: color-mix(in oklab, var(--muted-foreground) 30%, transparent);

  display: block;
  margin-block: 0 1em;
  padding: var(--space-xs) var(--space-s);
  border: 2px solid var(--border);
  font-size: var(--step--1);

  challenge-title {
    display: block;
    padding-block-end: var(--space-3xs);
    color: var(--foreground);
    font-weight: var(--font-weight-medium);
  }

  dl {
    display: flex;
    flex-direction: column;
    margin-block: 0;

    > div {
      display: flex;
      align-items: baseline;
      gap: var(--space-s);
      padding-block: var(--space-3xs);

      &:not(:last-child) {
        border-block-end: 1.5px solid var(--row-border);
      }
    }
  }

  dt {
    flex: 1;
    color: var(--muted-foreground);
    font-weight: var(--font-weight-medium);
  }

  dd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3xs);
    flex: 2;
    margin: 0;
    word-break: break-word;

    img {
      display: inline-block;
      margin: 0;
      border-radius: var(--radius-full);
      inline-size: 1em;
      block-size: 1em;
    }

    a {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    > p {
      margin-block: 0;
    }
  }

  > dl + p,
  > dl ~ * {
    margin-block: var(--space-2xs) 0;
  }
}

challenge-flag {
  word-break: break-all;
  filter: blur(4px);
  transition: filter 0.2s;
  user-select: all;

  &:hover {
    filter: none;
  }
}

.frame-center {
  display: block;
  margin-block: var(--space-m);
  margin-inline: auto;
  max-width: 100%;
}

.side-by-side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: fit-content;
  margin-inline: auto;

  > * {
    min-width: 0;
    margin-block: 0;
  }

  :is(p, img) {
    margin-block: 0;
  }

  @media (min-width: 640px) {
    flex-direction: row;
  }
}
</style>
