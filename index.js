#!/usr/bin/env node

(async () => {
  globalThis.s ??= {};
  s.sys ??= {};
  const sys = s.sys;
  const isBrowser = typeof window !== 'undefined';

  sys.sym ??= {};
  sys.sym.FN ??= Symbol('fn');
  sys.sym.IS_EMPTY ??= Symbol('isEmptyNode');
  sys.sym.IS_LOADED_FROM_DISC ??= Symbol('isLoadedFromDisc');
  sys.sym.TYPE_PATH ??= Symbol('typePath');
  sys.sym.TYPE_STREAM ??= Symbol('typeStream');

  Object.defineProperty(s, 'd', {
    writable: true, configurable: true, enumerable: false,
    value: (k, v) => Object.defineProperty(s, k, { writable: true, configurable: true, enumerable: false, value: v })
  });
  Object.defineProperty(s, 'def', {
    writable: true, configurable: true, enumerable: false,
    value: (k, v) => Object.defineProperty(s, k, { writable: true, configurable: true, enumerable: false, value: v })
  });
  Object.defineProperty(s, 'defObjectProp', {
    writable: true, configurable: true, enumerable: false,
    value: (o, k, v) => Object.defineProperty(o, k, { writable: true, configurable: true, enumerable: false, value: v })
  });
  s.d('l', console.log);
  s.isObject = d => typeof d === 'object' && !Array.isArray(d) && d !== null;
  s.d('isStr', str => typeof str === 'string');
  s.d('pathToArr', path => Array.isArray(path) ? path : path.split('.'));
  s.d('find', (path, nodeForSearch) => {
    let node = s;
    if (s.isObject(nodeForSearch)) node = nodeForSearch;

    const pathArr = s.pathToArr(path);
    return s.findByArray(pathArr, node);
  });
  s.d('findByArray', (path, nodeForSearch) => {
    let node = s;
    if (s.isObject(nodeForSearch)) node = nodeForSearch;

    for (let i = 0; i < path.length; i++) {
      if (typeof node !== 'object' || node === null) {
        return;
      }
      node = node[path[i]];
    }
    return node;
  });
  s.d('findParentAndK', (path, nodeForSearch) => {

    const pathArr = s.pathToArr(path);
    let node = s;
    if (s.isObject(nodeForSearch)) node = nodeForSearch;

    return {
      parent: pathArr.length === 1 ? node : s.find(pathArr.slice(0, -1), node),
      k: pathArr.at(-1)
    };
  });
  s.d('f', async (path, ...args) => {
    try {
      //todo node to stream
      let node = s.find(path);
      if (!node) {

        if (isBrowser) {
          const { js } = await s.fetchState(path);
          if (js) node = await s.u({ path, type: 'js', val: js });
        } else {
          if (!await s.isPathExistsOnFS(path, 'js')) return;
          node = await s.u({ path, type: 'js', options: { useFS: true } });
        }
      }

      let js;
      if (node[sys.sym.TYPE_STREAM]) js = node.get();
      else if (node.js) js = node.js;

      if (!js) {
        console.log(`js not found by path [${path}]`);
        return;
      }
      //if (!node[sys.sym.FN]) node[sys.sym.FN] = eval(node.js);
      return eval(js)(...args);

    } catch (e) { console.error(path, e); }
  });
  s.d('fsChangesStream', path => {
    return {
      isStarted: false,
      ac: new AbortController,
      start: async function () {
        if (this.isStarted) return;
        this.generator = await s.nodeFS.watch(path, { signal: this.ac.signal });
        for await (const e of this.generator) if (this.eventHandler) await this.eventHandler(e);
        s.l('fsChangesStream STARTED');
        this.isStarted = true;
      },
      stop: function () { this.ac.abort(); },
      eventHandler: null,
    }
  });
  s.d('create', path => {
    let pathArr = s.pathToArr(path);
    let node = s;

    for (let i = 0; i < pathArr.length; i++) {
      const k = pathArr[i];
      if (typeof node[k] !== 'object' || node[k] === null) {
        node[k] = {};
      }
      node = node[k];
    }
    return node;
  });
  s.d('set', (path, v, hiddenProps = {}) => {

    const pathArr = s.pathToArr(path);
    if (pathArr.length > 1) {
      s.create(pathArr.slice(0, -1));
    }
    const { parent, k } = s.findParentAndK(pathArr);
    if (!parent || !k || !v) return;

    //HIDE PROP LOGIC move to other function
    const hiddenPropsIsEmpty = Object.keys(hiddenProps).length === 0;
    if (hiddenPropsIsEmpty) {
      parent[k] = v; return;
    }
    if (hiddenProps.prop) {
      s.defObjectProp(parent, k, parent[k]); return;
    }
    if (hiddenProps.one) {
      const vData = s.findParentAndK(hiddenProps.one, v);
      s.defObjectProp(vData.parent, vData.k, vData.parent[vData.k]);
      parent[k] = v;
      return;
    }
    if (hiddenProps.each) {
      if (typeof v === 'object' && !Array.isArray(v)) {
        for (let k in v) {
          const obj = v[k];
          const vData = s.findParentAndK(hiddenProps.each, obj);

          s.defObjectProp(vData.parent, vData.k, vData.parent[vData.k]);
        }
      }
    }
    parent[k] = v;
  });
  s.d('cp', (oldPath, newPath) => {
    const { node, k } = getParentNodeAndKey(oldPath);
    if (!node || !k) {
      s.l(`No node or k. oldPath [${oldPath}]`)
      return;
    }

    let parentNodeAndKey = getParentNodeAndKey(newPath);
    let node2 = parentNodeAndKey.node;
    let k2 = parentNodeAndKey.k;
    if (!node2 || !k2) {
      s.l(`No node2 or k2. newPath [${newPath}]`)
      return;
    }
    node2[k2] = node[k];
    return { node, k };
  });
  s.d('update', (path, v) => {

    const pathArr = s.pathToArr(path);
    const { parent, k } = s.findParentAndK(pathArr);
    if (!parent || !k) return;

    //todo check operation for Array
    if (k === 'js') {
      eval(v); //use parser or lister for check syntax
      delete parent[sys.sym.FN];
    }
    parent[k] = v;
  });
  s.d('mv', (oldPath, newPath, sys) => {
    const { node, k } = cp(oldPath, newPath);
    delete node[k];

    //todo rename sysId if necessary
    if (oldPath.length !== 2 || newPath.length !== 2) {
      return;
    }
    if (oldPath[0] === 'net' && s.isStr(oldPath[1]) &&
      newPath[0] === 'net' && s.isStr(newPath[1]) &&
      sys.netId && sys.netId === oldPath[1]
    ) {
      sys.netId = newPath[1];
    }
  });
  s.d('rm', path => {
    const { node, k } = s.findParentAndK(path);
    if (!node || !k) return;
    delete node[k];
    if (k === 'js') delete node[sys.sym.FN];
  });
  s.d('merge', (o1, o2) => {

    for (let k in o2) {
      const v1 = o1[k];
      const v2 = o2[k];

      if (typeof v1 === 'object' && typeof v2 === 'object') {

        if (Array.isArray(v1) && Array.isArray(v2)) {
          o1[k] = o2[k];
          continue;
        }
        if (v1 === null || v2 === null) {
          o1[k] = o2[k];
          continue;
        }
        s.merge(v1, v2);
        continue;
      }
      o1[k] = o2[k];
    }
  });

  if (!s.u) {
    const {ulid} = await import('ulid');
    const { factory } = await import('./core/core.js');
    s.u = factory(s, ulid);
  }

  //GLOBAL PUB SUB
  s.defObjectProp(sys, 'eventHandlers', {});
  globalThis.e = new Proxy(() => { }, {
    apply(target, thisArg, args) {
      const handler = args[0];
      const data = args[1];

      if (sys.eventHandlers[handler]) {
        return sys.eventHandlers[handler](data);
      }
    },
    set(target, k, v) {
      sys.eventHandlers[k] = v;
      return true;
    }
  });
  s.d('e', e);

  if (isBrowser) {
    s.d('fetchState', async path => {
      const res = await fetch('/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.split('.') }),
      });
      return await res.json();
    });

    sys.proxyS = {};
    globalThis.s = new Proxy(s, sys.proxyS);

    //s.l(await s.f('sys.apps.GUI/mainJs'));
    const GUI = new (await s.f('sys.apps.GUI/mainJs'));
    await GUI.start();
    return;
  }
  s.d('parseCliArgs', cliArgs => {
    const args = {};
    let num = 0;

    for (let i = 0; i < cliArgs.length; i++) {
      if (i < 2) continue; //skip node and scriptName args

      let arg = cliArgs[i];
      args[num++] = arg;

      if (arg.includes('=')) {
        let [k, v] = arg.split('=');
        if (!v) {
          args[num] = arg; //start write args from main 0
          continue;
        }
        args[k.trim()] = v.trim();
      } else {
        args['cmd'] = arg;
      }
    }
    return args;
  });

  s.d('process', (await import('node:process')).default);
  s.d('processStop', () => { s.l('stop process ', s.process.pid); s.process.exit(0); });
  //s.def('processRestart', () => { s.l('stop process ', s.process.pid); s.process.exit(0); });
  s.d('nodeCrypto', await import('node:crypto'));
  s.d('nodeFS', (await import('node:fs')).promises);
  s.d('fsAccess', async path => {
    try { await s.nodeFS.access(path); return true; }
    catch { return false; }
  });
  s.d('pathToFSPath', path => `state/${s.pathToArr(path).join('/')}`);
  s.d('isPathExistsOnFS', async (path, fileExtension = '') => {
    const fsPath = s.pathToFSPath(path) + (fileExtension ? '.' + fileExtension : '');
    return await s.fsAccess(fsPath);
  });
  s.d('getFromFS', async (path, format = 'json') => {

    let fsPath = s.pathToFSPath(path);
    if (!await s.fsAccess(fsPath)) return;

    if (format === 'json') fsPath += '.json';

    const str = (await s.nodeFS.readFile(fsPath, 'utf8')).trim();
    return format === 'json' ? JSON.parse(str) : str;
  });
  s.d('cpFromFS', async (path, format = 'json', hiddenProps = {}) => {
    const v = await s.getFromFS(path, format);
    if (!v) return;
    s.set(path, v, hiddenProps);
  });
  s.d('syncFromDisc', async (path, format = 'json', hiddenProps = {}) => {

    const state = await s.getFromFS(path, format);
    if (!state) return;

    const currentState = s.find(path);
    for (let k in currentState) {
      if (!state[k]) delete currentState[k];
    }
    //delete what not exists in state
    s.merge(currentState, state);
    s.l('syncFromDisc', path, Object.keys(state).length);
  });
  s.d('cpToDisc', async (path, v = null, hiddenProps = {}) => {

    let pathArr = s.pathToArr(path);

    const dir = `state/${pathArr.slice(0, -1).join('/')}`;
    let file = `${dir}/${pathArr.at(-1)}.`;

    if (!await s.fsAccess(dir)) return;
    if (!v) v = s.find(pathArr);
    if (!v) return;

    if (typeof v === 'object' && v !== null) {
      file += 'json';

      if (hiddenProps.each) {
        const clone = structuredClone(v);
        for (let k in v) {
          clone[k][hiddenProps.each] = v[k][hiddenProps.each];
        }
        v = clone;
      } else if (hiddenProps.one) {
        const clone = structuredClone(v);
        const pathArray = s.pathToArr(hiddenProps.one);

        const { parent, k } = s.findParentAndK(hiddenProps.one, clone);
        parent[k] = s.find(pathArray, v);

        v = clone;
      }
      v = JSON.stringify(v);
    } else {
      file += 'txt';
      v = String(v);
    }
    await s.nodeFS.writeFile(file, v);
  });
  sys.getNetToken = () => {
    if (!sys.netId) return;
    if (!s.net[sys.netId]) return;
    return s.net[sys.netId].token;
  }
  s.defObjectProp(sys, 'getRandStr', (length) => {
    const symbols = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=<>?';
    const str = [];
    for (let i = 0; i < length; i++) {
      const randomIndex = s.nodeCrypto.randomInt(0, symbols.length);
      str.push(symbols.charAt(randomIndex));
    }
    return str.join('');
  });
  s.defObjectProp(sys, 'isEmptyDir', async (dir, ignore = []) => {
    let list = await s.nodeFS.readdir(dir);
    if (list.length === 0) return true;

    list = list.filter(i => !ignore.includes(i));
    return list.length === 0;
  });

  const cliArgs = s.parseCliArgs(s.process.argv);
  if (cliArgs[0] === 'set') {
    //const stream = await s.u({ path: cliArgs[1], conf: { useFS: true } });
    //return;
  }
  if (cliArgs[0] === 'get' && cliArgs[1]) {
    const stream = await s.u({ path: cliArgs[1], conf: { useFS: true } });
    s.l(stream);
    return;
  }

  //netObject, netObjectPart >> relation type net, relation type telephone
  await s.u({ path: 'item22', dataDefault: 'defaultNetId', conf: { useFS: true } });

  //fsBucket

  //const stream = await s.u({ path: 'sys.isObject', type: 'js', conf: { useFS: true, createFileWithExtention: true } });
  //s.l(stream.get());
  //s.l(stream.type);

  return;
  //if (sys.netId.get() && !s.net[sys.netId]) {
  //s.net[sys.netId] = {};
  //s.defObjectProp(s.net[sys.netId], 'token', sys.getRandStr(27));
  //await s.cpToDisc('net', null, { each: 'token' });
  //}
  // if (s.f('sys.isEmptyObject', s.users) && await sys.isEmptyDir('state/users', ['.gitignore'])) {
  //     await s.cpFromDisc('users.root', 'json', { one: '_sys_.password' });

  //     if (!s.users.root) {
  //         s.users.root = { _sys_: {} };
  //         s.defObjectProp(s.users.root._sys_, 'password', sys.getRandStr(25));
  //         await s.cpToDisc('users.root', null, { one: '_sys_.password' });
  //     }
  // }

  if (!sys.netUpdateIds) s.defObjectProp(sys, 'netUpdateIds', new Map);

  //LOOP
  if (!s.loop) {
    s.def('loop', {
      file: 'index.js',
      delay: 2000,
      isWorking: false,
      start: async function () {
        this.isWorking = true;
        while (1) {
          await new Promise(r => setTimeout(r, this.delay));
          try {
            if (!this.isWorking) break;
            const js = await s.nodeFS.readFile(this.file, 'utf8');
            eval(js);
            s.def('js', js);
          }
          catch (e) { console.log(e); }
        }
      },
      stop: function () { } //connect this to UI btn and API
    });
    s.process.on('uncaughtException', e => console.log('[[uncaughtException]]', e.stack));
  }
  if (!s.loop.isWorking) s.loop.start();

  if (sys.logger) {
    s.def('http', new (await s.f('sys.httpClient')));
    s.def('log', new (await s.f('sys.logger')));
    s.def('fs', new (await s.f('sys.fs'))(s.log));
    s.def('os', await s.f('sys.os'));
  }

  if (s.onceDB === undefined) s.def('onceDB', 0);
  s.def('once', id => {
    if (s.onceDB !== id) {
      s.onceDB = id;
      return true;
    }
    return false;
  });
  s.def('syncJsScripts', async (node, path) => {

    const isScriptsDirExists = await s.fsAccess('scripts');
    if (!isScriptsDirExists) return;

    const iterate = async (obj, kPath = '') => {

      if (Array.isArray(obj)) return;
      for (let k in obj) {

        const v = obj[k]; const vType = typeof v;
        if (vType === 'object') {
          await iterate(v, kPath ? (kPath + '.' + k) : k);

        } else if (vType === 'string' && k === 'js' && v) {

          if (kPath) await s.nodeFS.writeFile(`scripts/${kPath}.js`, v);
        }
      }
    }
    await iterate(node, path);

    const list = await s.nodeFS.readdir('scripts');
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const id = file.slice(0, -3);
      const node = s.find(id);
      if (!node) {
        s.l('delete', id);
        //await s.nodeFS.unlink();
      }
    }
  });
  sys.syncPath = (path, state) => {
    const currentState = s.find(path);
    for (let k in currentState) {
      if (!state[k]) delete currentState[k];
    }
    //delete what not exists in state
    s.merge(currentState, state);
    //s.l('syncPath', path, Object.keys(state).length);
  }
  if (!s.connectedSSERequests) s.def('connectedSSERequests', new Map);

  sys.rqParseBody = async (rq, limitMb = 12) => {

    let limit = limitMb * 1024 * 1024;
    return new Promise((resolve, reject) => {
      let b = [];
      let len = 0;

      rq.on('data', chunk => {
        len += chunk.length;
        if (len > limit) {
          rq.destroy();
          resolve({ err: `limit reached [${limitMb}mb]` });
          return;
        }
        b.push(chunk);
      });
      rq.on('error', err => reject(err));
      rq.on('end', () => {
        b = Buffer.concat(b);

        if (rq.headers['content-type'] === 'application/json') {
          try { b = JSON.parse(b.toString()); }
          catch (e) { b = { err: 'json parse error' }; }
        }
        resolve(b);
      });
    });
  }
  sys.rqParseQuery = (rq) => {
    const query = {};
    const url = new URL('http://t.c' + rq.url);
    url.searchParams.forEach((v, k) => {
      query[k] = v
    });
    return query;
  }
  sys.rqResolveStatic = async (rq, rs) => {

    const lastPart = rq.pathname.split('/').pop();
    const split = lastPart.split('.');
    if (split.length < 2) return false;

    const extension = split[split.length - 1]; if (!extension) return;
    try {
      const file = await s.nodeFS.readFile('.' + rq.pathname);
      const m = { html: 'text/html', js: 'text/javascript', css: 'text/css', map: 'application/json', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf' };
      if (m[extension]) rs.setHeader('Content-Type', m[extension]);

      rs.end(file);
      return true;
    } catch (e) {
      if (s.log) s.log.info(e.toString(), { path: e.path, syscall: e.syscall });
      else console.log(e);
      return false;
    }
  }
  sys.rqGetCookies = rq => {
    const header = rq.headers.cookie;
    if (!header || header.length < 1) {
      return {};
    }
    const cookies = header.split('; ');
    const result = {};
    for (let i in cookies) {

      const cookie = cookies[i].trim();
      const index = cookie.indexOf('=');
      if (index === -1) continue;

      const k = cookie.slice(0, index);
      const v = cookie.slice(index + 1);

      if (!k || !v) continue;

      result[k.trim()] = v.trim();
    }
    return result;
  }
  sys.rqAuthenticate = (rq) => {
    let { token } = sys.rqGetCookies(rq);
    const netToken = sys.getNetToken();
    return token && netToken && token === netToken;
  }
  sys.httpRqHandler = async (rq, rs) => {
    const ip = rq.socket.remoteAddress;
    const isLocal = ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
    rq.isLocal = isLocal;

    const url = new URL('http://t.c' + rq.url);
    rq.pathname = url.pathname;
    rq.mp = `${rq.method}:${url.pathname}`;
    s.l(ip, rq.mp);

    if (rq.pathname.includes('..')) {
      rs.writeHead(403).end('Path include ".." denied.'); return;
    }
    if (rq.pathname.toLowerCase().includes('/state/')) {
      rs.writeHead(403).end('Access to state dir is denied.'); return;
    }
    rs.s = (v, contentType) => {
      const s = (value, type) => rs.writeHead(200, { 'Content-Type': type }).end(value);

      if (!v) s('empty val', 'text/plain; charset=utf-8');
      else if (v instanceof Buffer) s(v, '');
      else if (typeof v === 'object') s(JSON.stringify(v), 'application/json');
      else if (typeof v === 'string' || typeof v === 'number') s(v, contentType ?? 'text/plain; charset=utf-8');
      else s('', 'text/plain');
    }

    const m = {
      'GET:/': async () => {
        if (!s.js) {
          rs.writeHead(500).end('server not ready');
          return;
        }
        const htmlStream = await s.u({ path: 'sys.apps.GUI.mainHtml', type: 'html', options: { useFS: 1 } });
        const html = htmlStream.get().replace('JS_SCRIPT', s.js);
        rs.s(html, 'text/html');
      },
      'POST:/cmd': async () => {
        if (!isLocal || !sys.rqAuthenticate(rq)) {
          rs.writeHead(403).end('denied');
          return;
        }
        const { cmd } = await sys.rqParseBody(rq);
        if (cmd) {
          try { eval(cmd); }
          catch (e) { console.log(e); }
        }
      },
      'GET:/stream': async () => {
        const rqId = await s.f('sys.uuid');

        s.log.info('SSE connected');
        s.connectedSSERequests.set(rqId, rs);
        rs.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'Cache-Control': 'no-cache' });

        rq.on('close', () => {
          s.connectedSSERequests.delete(rqId);
          s.log.info('SSE closed');
        });
        rq.isLongRequest = true;
      },
      'POST:/state': async () => {
        const { path, type } = await sys.rqParseBody(rq);
        if (!Array.isArray(path)) {
          rs.writeHead(403).end('Path is invalid.'); return;
        }
        //todo fix this according to new places of tokens
        if (path[0] === 'sys') {
          if (path[1] === 'secrets' || path[1] === 'token') {
            rs.writeHead(403).end('Access denied.'); return;
          }
        }
        if (path.length === 0) {
          const obj = {};
          Object.keys(s).forEach((k) => obj[k] = {});
          rs.s(obj); return;
        }

        //todo is path is dir so list dir in other case get file
        const stream = await s.u({ path, type, options: { useFS: 1 } });

        //turnOnFallbackEditing
        //let node = s.find(path);

        //detect is this dir or file
        // if (typeof node === 'object' && !Array.isArray(node)) {

        //     const pathStr = 'state/' + path.join('/');

        //     if (await s.fsAccess(pathStr)) {
        //         const list = await s.nodeFS.readdir(pathStr);
        //         for (let i = 0; i < list.length; i++) {
        //             const item = list[i];
        //             if (item.trim() === '.gitignore') continue;
        //             if (!node[item]) node[item] = {};
        //         }

        //     } else if (await s.fsAccess(pathStr + '.json')) {
        //         const { parent, k } = s.findParentAndK(path);
        //         node = JSON.parse(await s.nodeFS.readFile(pathStr + '.json', 'utf8'));
        //         if (parent && k) parent[k] = node;
        //     }
        // }
        rs.s({ js: js.get() });
      },
      'POST:/stateUpdate': async () => {
        if (!sys.rqStateUpdate) {
          rs.s('Server state is not ready.'); return;
        }
        //todo path on dysc js, css or move it inside sys.rqStateUpdate
        await s.f('sys.rqStateUpdate', rq, rs);
        //send updates to frontend
      },
      'POST:/sign/in': async () => {

        const { username, password } = await sys.rqParseBody(rq);
        if (!username || typeof username !== 'string') {
          rs.writeHead(400).end('userName is invalid.');
          return;
        }
        if (!password || typeof password !== 'string') {
          rs.writeHead(400).end('Token is invalid.');
          return;
        }
        const user = s.users[username];
        const userPassword = user._sys_.password;

        if (!user || !userPassword) {
          rs.writeHead(404).end('User not found or password not set.');
          return;
        }
        if (password !== userPassword) {
          rs.writeHead(401).end('Password is incorrect.');
          return;
        }
        rs.writeHead(200, {
          'Content-Type': 'text/plain',
          'Set-Cookie': [
            `username=${username}; Path=/; Max-Age=2580000; SameSite=Strict; Secure; HttpOnly`,
            `password=${password}; Path=/; Max-Age=2580000; SameSite=Strict; Secure; HttpOnly`
          ],
        }).end('ok');
      },
      'POST:/sign/out': async () => {
        rs.writeHead(200, {
          'Set-Cookie': `token=str; Path=/; Max-Age=-1; SameSite=Strict; Secure; HttpOnly`,
          'Content-Type': 'text/plain'
        }).end('ok');
      },
      'GET:/sign/user': async () => {
        let { username, password } = sys.rqGetCookies(rq);
        if (!username || !password) {
          rs.s({ user: null }); return;
        }
        if (typeof username !== 'string' || typeof password !== 'string') {
          rs.s({ user: null }); return;
        }
        //when try to read, make attempt read from disc
        const user = s.users[username];
        if (!user) {
          rs.s({ user: null }); return;
        }
        if (password !== user._sys_.password) {
          rs.s({ user: null }); return;
        }
        rs.s({ user: { username } });
      },
      'POST:/uploadFile': async () => {
        if (!rq.isLocal) { rs.writeHead(403).end('denied'); return; }

        const b = await sys.rqParseBody(rq);
        if (b.err) return;
        if (b) await s.nodeFS.writeFile('testFIL', b);
        rs.s('ok');
      },
    }

    if (sys.rqResolveStatic && await sys.rqResolveStatic(rq, rs)) return;
    if (m[rq.mp]) {
      try { await m[rq.mp](); }
      catch (e) {
        s.log ? s.log.error(e) : console.log(e);
        rs.writeHead(500).end('Internal server error.');
      }
    }
    if (!rq.isLongRequest && !rs.writableEnded) {
      rs.s('Default response.');
    }
  };

  if (!s.server) {
    s.def('nodeHttp', await import('node:http'));
    s.def('server', s.nodeHttp.createServer((rq, rs) => {
      if (!sys.httpRqHandler || typeof sys.httpRqHandler !== 'function') {
        rs.writeHead(500).end('Server not ready.');
        return;
      }
      sys.httpRqHandler(rq, rs)
    }));
    s.def('serverStop', () => {
      s.server.closeAllConnections();
      s.server.close(() => s.server.closeAllConnections());
      s.l('server stop');
    });
    s.def('serverRestart', port => {
      s.server.closeAllConnections();
      s.server.close(() => {
        s.l('server stop');
        s.server.closeAllConnections();
        s.server.listen(port, () => s.l(`server start ${port}`));
      });
    });
  }

  // if (!s.logListenerProc && sys.logger) {

  //     const logger = new (await s.f('sys.logger'));
  //     logger.mute();
  //     logger.onMessage(msg => {
  //         const json = JSON.stringify({ logMsg: msg });
  //         for (let [k, v] of s.connectedSSERequests) {
  //             v.write(`data: ${json}\n\n`);
  //         }
  //     });
  //     s.def('logListenerProc', new s.os(logger));
  //     s.logListenerProc.run('tail -f index.log', false, false);
  // }

  const trigger = async () => {
    console.log('ONCE', new Date);

    //await s.subPath('scripts', );

    //controll of watchers from declarativeUI
    if (s.scriptsSub) {
      //s.def('scriptsSub', await s.subPath('scripts'));
      //s.scriptsWatcher.start();
    }
    if (s.scriptsWatcher) {
      await s.syncJsScripts(sys, 'sys');

      s.scriptsWatcher.slicer = async (e) => {
        if (e.eventType !== 'change') return;

        const id = e.filename.slice(0, -3);
        const node = s.find(id);
        if (!node) return;

        const tNode = typeof node;
        console.log('updateFromFS', e.filename);
        const js = await s.nodeFS.readFile('scripts/' + e.filename, 'utf8');
        if (js === node.js) {
          console.log('js already updated');
          return;
        }
        try {
          eval(js);
          if (tNode === 'object') node.js = js;
          delete node[sys.sym.FN];

          //for detect path use scriptsDirExists
          await s.cpToDisc('sys');

        } catch (e) { s.log.error(e.toString(), e.stack); }
      }
    }

    const netId = await s.fsAccess('state/sys/netId.txt');
    //if (netId && !s.scriptsWatcher && sys.fsChangesSlicer) {
    //s.def('scriptsWatcher', await s.f('sys.fsChangesSlicer', 'scripts'));
    //s.scriptsWatcher.start();
    //}

    if (s.server) s.server.listen(8080, () => console.log(`httpServer start port: 8080`));
  }
  s.def('trigger', async () => await trigger());
  if (s.once(2)) await trigger();
  //s.processStop();

  sys.promiseCreate = async (f, timeoutSeconds = 7) => {

    return new Promise((res, rej) => {

      (async () => {
        let timeout = setTimeout(() => {
          rej({ err: 'promise timeout', f: f.toString() });
        }, timeoutSeconds * 1000);
        await f();
        clearTimeout(timeout);
        res();
      })();
    });
  }

  if (!s.net[sys.netId]) return;

  const netCmds = s.net[sys.netId].cmds;

  if (!netCmds) return;

  for (let i in netCmds) {

    const conf = netCmds[i];
    if (conf.cmd && conf.isEnabled) {
      const f = eval(`async () => { ${conf.cmd} }`);

      if (!conf.promise) {
        try {
          conf.promise = sys.promiseCreate(f);
          await conf.promise;
        } catch (e) {
          s.l(e);
        } finally {
          delete conf.promise;
        }
      }

    }
  }

})();
