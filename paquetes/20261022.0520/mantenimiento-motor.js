(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // ../../../Users/juancarlosjimenezlima/Proyectos/Vidaire_Obras/node_modules/sql.js/dist/sql-wasm-browser.js
  var require_sql_wasm_browser = __commonJS({
    "../../../Users/juancarlosjimenezlima/Proyectos/Vidaire_Obras/node_modules/sql.js/dist/sql-wasm-browser.js"(exports, module) {
      var initSqlJsPromise = void 0;
      var initSqlJs2 = function(moduleConfig) {
        if (initSqlJsPromise) {
          return initSqlJsPromise;
        }
        initSqlJsPromise = new Promise(function(resolveModule, reject) {
          var Module = typeof moduleConfig !== "undefined" ? moduleConfig : {};
          var originalOnAbortFunction = Module["onAbort"];
          Module["onAbort"] = function(errorThatCausedAbort) {
            reject(new Error(errorThatCausedAbort));
            if (originalOnAbortFunction) {
              originalOnAbortFunction(errorThatCausedAbort);
            }
          };
          Module["postRun"] = Module["postRun"] || [];
          Module["postRun"].push(function() {
            resolveModule(Module);
          });
          module = void 0;
          var k;
          k ||= typeof Module != "undefined" ? Module : {};
          var aa = !!globalThis.window, ba = !!globalThis.WorkerGlobalScope;
          k.onRuntimeInitialized = function() {
            function a(f, l) {
              switch (typeof l) {
                case "boolean":
                  bc(f, l ? 1 : 0);
                  break;
                case "number":
                  cc(f, l);
                  break;
                case "string":
                  dc(f, l, -1, -1);
                  break;
                case "object":
                  if (null === l) eb(f);
                  else if (null != l.length) {
                    var n = ca(l.length);
                    m.set(l, n);
                    ec(f, n, l.length, -1);
                    da(n);
                  } else ua(f, "Wrong API use : tried to return a value of an unknown type (" + l + ").", -1);
                  break;
                default:
                  eb(f);
              }
            }
            function b(f, l) {
              for (var n = [], p = 0; p < f; p += 1) {
                var r = t(l + 4 * p, "i32"), v = fc(r);
                if (1 === v || 2 === v) r = gc(r);
                else if (3 === v) r = hc(r);
                else if (4 === v) {
                  v = r;
                  r = ic(v);
                  v = jc(v);
                  for (var J = new Uint8Array(r), I = 0; I < r; I += 1) J[I] = m[v + I];
                  r = J;
                } else r = null;
                n.push(r);
              }
              return n;
            }
            function c(f, l) {
              this.Qa = f;
              this.db = l;
              this.Oa = 1;
              this.yb = [];
            }
            function d(f, l) {
              this.db = l;
              this.ob = ea(f);
              if (null === this.ob) throw Error("Unable to allocate memory for the SQL string");
              this.ub = this.ob;
              this.gb = this.Fb = null;
            }
            function e(f) {
              this.filename = "dbfile_" + (4294967295 * Math.random() >>> 0);
              if (null != f) {
                var l = this.filename, n = "/", p = l;
                n && (n = "string" == typeof n ? n : fa(n), p = l ? ha(n + "/" + l) : n);
                l = ia(true, true);
                p = ja(
                  p,
                  l
                );
                if (f) {
                  if ("string" == typeof f) {
                    n = Array(f.length);
                    for (var r = 0, v = f.length; r < v; ++r) n[r] = f.charCodeAt(r);
                    f = n;
                  }
                  ka(p, l | 146);
                  n = ma(p, 577);
                  na(n, f, 0, f.length, 0);
                  oa(n);
                  ka(p, l);
                }
              }
              this.handleError(q(this.filename, g));
              this.db = t(g, "i32");
              hb(this.db);
              this.pb = {};
              this.Sa = {};
            }
            var g = y(4), h = k.cwrap, q = h("sqlite3_open", "number", ["string", "number"]), w = h("sqlite3_close_v2", "number", ["number"]), u = h("sqlite3_exec", "number", ["number", "string", "number", "number", "number"]), x = h("sqlite3_changes", "number", ["number"]), D = h(
              "sqlite3_prepare_v2",
              "number",
              ["number", "string", "number", "number", "number"]
            ), ib = h("sqlite3_sql", "string", ["number"]), lc = h("sqlite3_normalized_sql", "string", ["number"]), jb = h("sqlite3_prepare_v2", "number", ["number", "number", "number", "number", "number"]), mc = h("sqlite3_bind_text", "number", ["number", "number", "number", "number", "number"]), kb = h("sqlite3_bind_blob", "number", ["number", "number", "number", "number", "number"]), nc = h("sqlite3_bind_double", "number", ["number", "number", "number"]), oc = h("sqlite3_bind_int", "number", [
              "number",
              "number",
              "number"
            ]), pc = h("sqlite3_bind_parameter_index", "number", ["number", "string"]), qc = h("sqlite3_step", "number", ["number"]), rc = h("sqlite3_errmsg", "string", ["number"]), sc = h("sqlite3_column_count", "number", ["number"]), tc = h("sqlite3_data_count", "number", ["number"]), uc = h("sqlite3_column_double", "number", ["number", "number"]), lb = h("sqlite3_column_text", "string", ["number", "number"]), vc = h("sqlite3_column_blob", "number", ["number", "number"]), wc = h("sqlite3_column_bytes", "number", ["number", "number"]), xc = h(
              "sqlite3_column_type",
              "number",
              ["number", "number"]
            ), yc = h("sqlite3_column_name", "string", ["number", "number"]), zc = h("sqlite3_reset", "number", ["number"]), Ac = h("sqlite3_clear_bindings", "number", ["number"]), Bc = h("sqlite3_finalize", "number", ["number"]), mb = h("sqlite3_create_function_v2", "number", "number string number number number number number number number".split(" ")), fc = h("sqlite3_value_type", "number", ["number"]), ic = h("sqlite3_value_bytes", "number", ["number"]), hc = h("sqlite3_value_text", "string", ["number"]), jc = h(
              "sqlite3_value_blob",
              "number",
              ["number"]
            ), gc = h("sqlite3_value_double", "number", ["number"]), cc = h("sqlite3_result_double", "", ["number", "number"]), eb = h("sqlite3_result_null", "", ["number"]), dc = h("sqlite3_result_text", "", ["number", "string", "number", "number"]), ec = h("sqlite3_result_blob", "", ["number", "number", "number", "number"]), bc = h("sqlite3_result_int", "", ["number", "number"]), ua = h("sqlite3_result_error", "", ["number", "string", "number"]), nb = h("sqlite3_aggregate_context", "number", ["number", "number"]), hb = h(
              "RegisterExtensionFunctions",
              "number",
              ["number"]
            ), ob = h("sqlite3_update_hook", "number", ["number", "number", "number"]);
            c.prototype.bind = function(f) {
              if (!this.Qa) throw "Statement closed";
              this.reset();
              return Array.isArray(f) ? this.Wb(f) : null != f && "object" === typeof f ? this.Xb(f) : true;
            };
            c.prototype.step = function() {
              if (!this.Qa) throw "Statement closed";
              this.Oa = 1;
              var f = qc(this.Qa);
              switch (f) {
                case 100:
                  return true;
                case 101:
                  return false;
                default:
                  throw this.db.handleError(f);
              }
            };
            c.prototype.Pb = function(f) {
              null == f && (f = this.Oa, this.Oa += 1);
              return uc(this.Qa, f);
            };
            c.prototype.hc = function(f) {
              null == f && (f = this.Oa, this.Oa += 1);
              f = lb(this.Qa, f);
              if ("function" !== typeof BigInt) throw Error("BigInt is not supported");
              return BigInt(f);
            };
            c.prototype.mc = function(f) {
              null == f && (f = this.Oa, this.Oa += 1);
              return lb(this.Qa, f);
            };
            c.prototype.getBlob = function(f) {
              null == f && (f = this.Oa, this.Oa += 1);
              var l = wc(this.Qa, f);
              f = vc(this.Qa, f);
              for (var n = new Uint8Array(l), p = 0; p < l; p += 1) n[p] = m[f + p];
              return n;
            };
            c.prototype.get = function(f, l) {
              l = l || {};
              null != f && this.bind(f) && this.step();
              f = [];
              for (var n = tc(this.Qa), p = 0; p < n; p += 1) switch (xc(this.Qa, p)) {
                case 1:
                  var r = l.useBigInt ? this.hc(p) : this.Pb(p);
                  f.push(r);
                  break;
                case 2:
                  f.push(this.Pb(p));
                  break;
                case 3:
                  f.push(this.mc(p));
                  break;
                case 4:
                  f.push(this.getBlob(p));
                  break;
                default:
                  f.push(null);
              }
              return f;
            };
            c.prototype.Db = function() {
              for (var f = [], l = sc(this.Qa), n = 0; n < l; n += 1) f.push(yc(this.Qa, n));
              return f;
            };
            c.prototype.Ob = function(f, l) {
              f = this.get(f, l);
              l = this.Db();
              for (var n = {}, p = 0; p < l.length; p += 1) n[l[p]] = f[p];
              return n;
            };
            c.prototype.lc = function() {
              return ib(this.Qa);
            };
            c.prototype.ic = function() {
              return lc(this.Qa);
            };
            c.prototype.Jb = function(f) {
              null != f && this.bind(f);
              this.step();
              return this.reset();
            };
            c.prototype.Lb = function(f, l) {
              null == l && (l = this.Oa, this.Oa += 1);
              f = ea(f);
              this.yb.push(f);
              this.db.handleError(mc(this.Qa, l, f, -1, 0));
            };
            c.prototype.Vb = function(f, l) {
              null == l && (l = this.Oa, this.Oa += 1);
              var n = ca(f.length);
              m.set(f, n);
              this.yb.push(n);
              this.db.handleError(kb(this.Qa, l, n, f.length, 0));
            };
            c.prototype.Kb = function(f, l) {
              null == l && (l = this.Oa, this.Oa += 1);
              this.db.handleError((f === (f | 0) ? oc : nc)(
                this.Qa,
                l,
                f
              ));
            };
            c.prototype.Yb = function(f) {
              null == f && (f = this.Oa, this.Oa += 1);
              kb(this.Qa, f, 0, 0, 0);
            };
            c.prototype.Mb = function(f, l) {
              null == l && (l = this.Oa, this.Oa += 1);
              switch (typeof f) {
                case "string":
                  this.Lb(f, l);
                  return;
                case "number":
                  this.Kb(f, l);
                  return;
                case "bigint":
                  this.Lb(f.toString(), l);
                  return;
                case "boolean":
                  this.Kb(f + 0, l);
                  return;
                case "object":
                  if (null === f) {
                    this.Yb(l);
                    return;
                  }
                  if (null != f.length) {
                    this.Vb(f, l);
                    return;
                  }
              }
              throw "Wrong API use : tried to bind a value of an unknown type (" + f + ").";
            };
            c.prototype.Xb = function(f) {
              var l = this;
              Object.keys(f).forEach(function(n) {
                var p = pc(l.Qa, n);
                0 !== p && l.Mb(f[n], p);
              });
              return true;
            };
            c.prototype.Wb = function(f) {
              for (var l = 0; l < f.length; l += 1) this.Mb(f[l], l + 1);
              return true;
            };
            c.prototype.reset = function() {
              this.Cb();
              return 0 === Ac(this.Qa) && 0 === zc(this.Qa);
            };
            c.prototype.Cb = function() {
              for (var f; void 0 !== (f = this.yb.pop()); ) da(f);
            };
            c.prototype.cb = function() {
              this.Cb();
              var f = 0 === Bc(this.Qa);
              delete this.db.pb[this.Qa];
              this.Qa = 0;
              return f;
            };
            d.prototype.next = function() {
              if (null === this.ob) return { done: true };
              null !== this.gb && (this.gb.cb(), this.gb = null);
              if (!this.db.db) throw this.Ab(), Error("Database closed");
              var f = pa(), l = y(4);
              qa(g);
              qa(l);
              try {
                this.db.handleError(jb(this.db.db, this.ub, -1, g, l));
                this.ub = t(l, "i32");
                var n = t(g, "i32");
                if (0 === n) return this.Ab(), { done: true };
                this.gb = new c(n, this.db);
                this.db.pb[n] = this.gb;
                return { value: this.gb, done: false };
              } catch (p) {
                throw this.Fb = z(this.ub), this.Ab(), p;
              } finally {
                ra(f);
              }
            };
            d.prototype.Ab = function() {
              da(this.ob);
              this.ob = null;
            };
            d.prototype.jc = function() {
              return null !== this.Fb ? this.Fb : z(this.ub);
            };
            "function" === typeof Symbol && "symbol" === typeof Symbol.iterator && (d.prototype[Symbol.iterator] = function() {
              return this;
            });
            e.prototype.Jb = function(f, l) {
              if (!this.db) throw "Database closed";
              if (l) {
                f = this.Gb(f, l);
                try {
                  f.step();
                } finally {
                  f.cb();
                }
              } else this.handleError(u(this.db, f, 0, 0, g));
              return this;
            };
            e.prototype.exec = function(f, l, n) {
              if (!this.db) throw "Database closed";
              var p = pa(), r = null, v = null, J = null;
              try {
                J = v = ea(f);
                var I = y(4);
                for (f = []; 0 !== t(J, "i8"); ) {
                  qa(g);
                  qa(I);
                  this.handleError(jb(this.db, J, -1, g, I));
                  var L2 = t(g, "i32");
                  J = t(I, "i32");
                  if (0 !== L2) {
                    var G = null;
                    r = new c(L2, this);
                    for (null != l && r.bind(l); r.step(); ) null === G && (G = { columns: r.Db(), values: [] }, f.push(G)), G.values.push(r.get(null, n));
                    r.cb();
                  }
                }
                return f;
              } catch (la) {
                throw r && r.cb(), la;
              } finally {
                v && da(v), ra(p);
              }
            };
            e.prototype.ec = function(f, l, n, p, r) {
              "function" === typeof l && (p = n, n = l, l = void 0);
              f = this.Gb(f, l);
              try {
                for (; f.step(); ) n(f.Ob(null, r));
              } finally {
                f.cb();
              }
              if ("function" === typeof p) return p();
            };
            e.prototype.Gb = function(f, l) {
              qa(g);
              this.handleError(D(this.db, f, -1, g, 0));
              f = t(g, "i32");
              if (0 === f) throw "Nothing to prepare";
              var n = new c(f, this);
              null != l && n.bind(l);
              return this.pb[f] = n;
            };
            e.prototype.pc = function(f) {
              return new d(f, this);
            };
            e.prototype.fc = function() {
              Object.values(this.pb).forEach(function(l) {
                l.cb();
              });
              Object.values(this.Sa).forEach(A);
              this.Sa = {};
              this.handleError(w(this.db));
              var f = sa(this.filename);
              this.handleError(q(this.filename, g));
              this.db = t(g, "i32");
              hb(this.db);
              return f;
            };
            e.prototype.close = function() {
              null !== this.db && (Object.values(this.pb).forEach(function(f) {
                f.cb();
              }), Object.values(this.Sa).forEach(A), this.Sa = {}, this.fb && (A(this.fb), this.fb = void 0), this.handleError(w(this.db)), ta("/" + this.filename), this.db = null);
            };
            e.prototype.handleError = function(f) {
              if (0 === f) return null;
              f = rc(this.db);
              throw Error(f);
            };
            e.prototype.kc = function() {
              return x(this.db);
            };
            e.prototype.bc = function(f, l) {
              Object.prototype.hasOwnProperty.call(this.Sa, f) && (A(this.Sa[f]), delete this.Sa[f]);
              var n = va(function(p, r, v) {
                r = b(r, v);
                try {
                  var J = l.apply(null, r);
                } catch (I) {
                  ua(p, I, -1);
                  return;
                }
                a(p, J);
              }, "viii");
              this.Sa[f] = n;
              this.handleError(mb(
                this.db,
                f,
                l.length,
                1,
                0,
                n,
                0,
                0,
                0
              ));
              return this;
            };
            e.prototype.ac = function(f, l) {
              var n = l.init || function() {
                return null;
              }, p = l.finalize || function(L2) {
                return L2;
              }, r = l.step;
              if (!r) throw "An aggregate function must have a step function in " + f;
              var v = {};
              Object.hasOwnProperty.call(this.Sa, f) && (A(this.Sa[f]), delete this.Sa[f]);
              l = f + "__finalize";
              Object.hasOwnProperty.call(this.Sa, l) && (A(this.Sa[l]), delete this.Sa[l]);
              var J = va(function(L2, G, la) {
                var V = nb(L2, 1);
                Object.hasOwnProperty.call(v, V) || (v[V] = n());
                G = b(G, la);
                G = [v[V]].concat(G);
                try {
                  v[V] = r.apply(null, G);
                } catch (Dc) {
                  delete v[V], ua(L2, Dc, -1);
                }
              }, "viii"), I = va(function(L2) {
                var G = nb(L2, 1);
                try {
                  var la = p(v[G]);
                } catch (V) {
                  delete v[G];
                  ua(L2, V, -1);
                  return;
                }
                a(L2, la);
                delete v[G];
              }, "vi");
              this.Sa[f] = J;
              this.Sa[l] = I;
              this.handleError(mb(this.db, f, r.length - 1, 1, 0, 0, J, I, 0));
              return this;
            };
            e.prototype.vc = function(f) {
              this.fb && (ob(this.db, 0, 0), A(this.fb), this.fb = void 0);
              if (!f) return this;
              this.fb = va(function(l, n, p, r, v) {
                switch (n) {
                  case 18:
                    l = "insert";
                    break;
                  case 23:
                    l = "update";
                    break;
                  case 9:
                    l = "delete";
                    break;
                  default:
                    throw "unknown operationCode in updateHook callback: " + n;
                }
                p = z(p);
                r = z(r);
                if (v > Number.MAX_SAFE_INTEGER) throw "rowId too big to fit inside a Number";
                f(l, p, r, Number(v));
              }, "viiiij");
              ob(this.db, this.fb, 0);
              return this;
            };
            c.prototype.bind = c.prototype.bind;
            c.prototype.step = c.prototype.step;
            c.prototype.get = c.prototype.get;
            c.prototype.getColumnNames = c.prototype.Db;
            c.prototype.getAsObject = c.prototype.Ob;
            c.prototype.getSQL = c.prototype.lc;
            c.prototype.getNormalizedSQL = c.prototype.ic;
            c.prototype.run = c.prototype.Jb;
            c.prototype.reset = c.prototype.reset;
            c.prototype.freemem = c.prototype.Cb;
            c.prototype.free = c.prototype.cb;
            d.prototype.next = d.prototype.next;
            d.prototype.getRemainingSQL = d.prototype.jc;
            e.prototype.run = e.prototype.Jb;
            e.prototype.exec = e.prototype.exec;
            e.prototype.each = e.prototype.ec;
            e.prototype.prepare = e.prototype.Gb;
            e.prototype.iterateStatements = e.prototype.pc;
            e.prototype["export"] = e.prototype.fc;
            e.prototype.close = e.prototype.close;
            e.prototype.handleError = e.prototype.handleError;
            e.prototype.getRowsModified = e.prototype.kc;
            e.prototype.create_function = e.prototype.bc;
            e.prototype.create_aggregate = e.prototype.ac;
            e.prototype.updateHook = e.prototype.vc;
            k.Database = e;
          };
          var wa = "./this.program", xa = globalThis.document?.currentScript?.src;
          ba && (xa = self.location.href);
          var ya = "", za, Aa;
          if (aa || ba) {
            try {
              ya = new URL(".", xa).href;
            } catch {
            }
            ba && (Aa = (a) => {
              var b = new XMLHttpRequest();
              b.open("GET", a, false);
              b.responseType = "arraybuffer";
              b.send(null);
              return new Uint8Array(b.response);
            });
            za = async (a) => {
              a = await fetch(a, { credentials: "same-origin" });
              if (a.ok) return a.arrayBuffer();
              throw Error(a.status + " : " + a.url);
            };
          }
          var Ba = console.log.bind(console), B = console.error.bind(console), Ca, Da = false, Ea, m, C, Fa, E, F, Ga, Ha, H;
          function Ia() {
            var a = Ja.buffer;
            m = new Int8Array(a);
            Fa = new Int16Array(a);
            C = new Uint8Array(a);
            new Uint16Array(a);
            E = new Int32Array(a);
            F = new Uint32Array(a);
            Ga = new Float32Array(a);
            Ha = new Float64Array(a);
            H = new BigInt64Array(a);
            new BigUint64Array(a);
          }
          function Ka(a) {
            k.onAbort?.(a);
            a = "Aborted(" + a + ")";
            B(a);
            Da = true;
            throw new WebAssembly.RuntimeError(a + ". Build with -sASSERTIONS for more info.");
          }
          var La;
          async function Ma(a) {
            if (!Ca) try {
              var b = await za(a);
              return new Uint8Array(b);
            } catch {
            }
            if (a == La && Ca) a = new Uint8Array(Ca);
            else if (Aa) a = Aa(a);
            else throw "both async and sync fetching of the wasm failed";
            return a;
          }
          async function Na(a, b) {
            try {
              var c = await Ma(a);
              return await WebAssembly.instantiate(c, b);
            } catch (d) {
              B(`failed to asynchronously prepare wasm: ${d}`), Ka(d);
            }
          }
          async function Oa(a) {
            var b = La;
            if (!Ca) try {
              var c = fetch(b, { credentials: "same-origin" });
              return await WebAssembly.instantiateStreaming(c, a);
            } catch (d) {
              B(`wasm streaming compile failed: ${d}`), B("falling back to ArrayBuffer instantiation");
            }
            return Na(b, a);
          }
          class Pa {
            name = "ExitStatus";
            constructor(a) {
              this.message = `Program terminated with exit(${a})`;
              this.status = a;
            }
          }
          var Qa = (a) => {
            for (; 0 < a.length; ) a.shift()(k);
          }, Ra = [], Sa = [], Ta = () => {
            var a = k.preRun.shift();
            Sa.push(a);
          }, K = 0, Ua = null;
          function t(a, b = "i8") {
            b.endsWith("*") && (b = "*");
            switch (b) {
              case "i1":
                return m[a];
              case "i8":
                return m[a];
              case "i16":
                return Fa[a >> 1];
              case "i32":
                return E[a >> 2];
              case "i64":
                return H[a >> 3];
              case "float":
                return Ga[a >> 2];
              case "double":
                return Ha[a >> 3];
              case "*":
                return F[a >> 2];
              default:
                Ka(`invalid type for getValue: ${b}`);
            }
          }
          var Va = true;
          function qa(a) {
            var b = "i32";
            b.endsWith("*") && (b = "*");
            switch (b) {
              case "i1":
                m[a] = 0;
                break;
              case "i8":
                m[a] = 0;
                break;
              case "i16":
                Fa[a >> 1] = 0;
                break;
              case "i32":
                E[a >> 2] = 0;
                break;
              case "i64":
                H[a >> 3] = BigInt(0);
                break;
              case "float":
                Ga[a >> 2] = 0;
                break;
              case "double":
                Ha[a >> 3] = 0;
                break;
              case "*":
                F[a >> 2] = 0;
                break;
              default:
                Ka(`invalid type for setValue: ${b}`);
            }
          }
          var Wa = new TextDecoder(), Xa = (a, b, c, d) => {
            c = b + c;
            if (d) return c;
            for (; a[b] && !(b >= c); ) ++b;
            return b;
          }, z = (a, b, c) => a ? Wa.decode(C.subarray(a, Xa(C, a, b, c))) : "", Ya = (a, b) => {
            for (var c = 0, d = a.length - 1; 0 <= d; d--) {
              var e = a[d];
              "." === e ? a.splice(d, 1) : ".." === e ? (a.splice(d, 1), c++) : c && (a.splice(d, 1), c--);
            }
            if (b) for (; c; c--) a.unshift("..");
            return a;
          }, ha = (a) => {
            var b = "/" === a.charAt(0), c = "/" === a.slice(-1);
            (a = Ya(a.split("/").filter((d) => !!d), !b).join("/")) || b || (a = ".");
            a && c && (a += "/");
            return (b ? "/" : "") + a;
          }, Za = (a) => {
            var b = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(a).slice(1);
            a = b[0];
            b = b[1];
            if (!a && !b) return ".";
            b &&= b.slice(0, -1);
            return a + b;
          }, $a = (a) => a && a.match(/([^\/]+|\/)\/*$/)[1], ab = () => (a) => crypto.getRandomValues(a), bb = (a) => {
            (bb = ab())(a);
          }, cb = (...a) => {
            for (var b = "", c = false, d = a.length - 1; -1 <= d && !c; d--) {
              c = 0 <= d ? a[d] : "/";
              if ("string" != typeof c) throw new TypeError("Arguments to path.resolve must be strings");
              if (!c) return "";
              b = c + "/" + b;
              c = "/" === c.charAt(0);
            }
            b = Ya(b.split("/").filter((e) => !!e), !c).join("/");
            return (c ? "/" : "") + b || ".";
          }, db = (a) => {
            var b = Xa(a, 0);
            return Wa.decode(a.buffer ? a.subarray(0, b) : new Uint8Array(a.slice(0, b)));
          }, fb = [], gb = (a) => {
            for (var b = 0, c = 0; c < a.length; ++c) {
              var d = a.charCodeAt(c);
              127 >= d ? b++ : 2047 >= d ? b += 2 : 55296 <= d && 57343 >= d ? (b += 4, ++c) : b += 3;
            }
            return b;
          }, M = (a, b, c, d) => {
            if (!(0 < d)) return 0;
            var e = c;
            d = c + d - 1;
            for (var g = 0; g < a.length; ++g) {
              var h = a.codePointAt(g);
              if (127 >= h) {
                if (c >= d) break;
                b[c++] = h;
              } else if (2047 >= h) {
                if (c + 1 >= d) break;
                b[c++] = 192 | h >> 6;
                b[c++] = 128 | h & 63;
              } else if (65535 >= h) {
                if (c + 2 >= d) break;
                b[c++] = 224 | h >> 12;
                b[c++] = 128 | h >> 6 & 63;
                b[c++] = 128 | h & 63;
              } else {
                if (c + 3 >= d) break;
                b[c++] = 240 | h >> 18;
                b[c++] = 128 | h >> 12 & 63;
                b[c++] = 128 | h >> 6 & 63;
                b[c++] = 128 | h & 63;
                g++;
              }
            }
            b[c] = 0;
            return c - e;
          }, pb = [];
          function qb(a, b) {
            pb[a] = { input: [], output: [], kb: b };
            rb(a, sb);
          }
          var sb = { open(a) {
            var b = pb[a.node.nb];
            if (!b) throw new N(43);
            a.Va = b;
            a.seekable = false;
          }, close(a) {
            a.Va.kb.lb(a.Va);
          }, lb(a) {
            a.Va.kb.lb(a.Va);
          }, read(a, b, c, d) {
            if (!a.Va || !a.Va.kb.Qb) throw new N(60);
            for (var e = 0, g = 0; g < d; g++) {
              try {
                var h = a.Va.kb.Qb(a.Va);
              } catch (q) {
                throw new N(29);
              }
              if (void 0 === h && 0 === e) throw new N(6);
              if (null === h || void 0 === h) break;
              e++;
              b[c + g] = h;
            }
            e && (a.node.$a = Date.now());
            return e;
          }, write(a, b, c, d) {
            if (!a.Va || !a.Va.kb.Hb) throw new N(60);
            try {
              for (var e = 0; e < d; e++) a.Va.kb.Hb(a.Va, b[c + e]);
            } catch (g) {
              throw new N(29);
            }
            d && (a.node.Ua = a.node.Ta = Date.now());
            return e;
          } }, tb = { Qb() {
            a: {
              if (!fb.length) {
                var a = null;
                globalThis.window?.prompt && (a = window.prompt("Input: "), null !== a && (a += "\n"));
                if (!a) {
                  var b = null;
                  break a;
                }
                b = Array(gb(a) + 1);
                a = M(a, b, 0, b.length);
                b.length = a;
                fb = b;
              }
              b = fb.shift();
            }
            return b;
          }, Hb(a, b) {
            null === b || 10 === b ? (Ba(db(a.output)), a.output = []) : 0 != b && a.output.push(b);
          }, lb(a) {
            0 < a.output?.length && (Ba(db(a.output)), a.output = []);
          }, Dc() {
            return { yc: 25856, Ac: 5, xc: 191, zc: 35387, wc: [
              3,
              28,
              127,
              21,
              4,
              0,
              1,
              0,
              17,
              19,
              26,
              0,
              18,
              15,
              23,
              22,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0
            ] };
          }, Ec() {
            return 0;
          }, Fc() {
            return [24, 80];
          } }, ub = { Hb(a, b) {
            null === b || 10 === b ? (B(db(a.output)), a.output = []) : 0 != b && a.output.push(b);
          }, lb(a) {
            0 < a.output?.length && (B(db(a.output)), a.output = []);
          } }, O = { Za: null, ab() {
            return O.createNode(null, "/", 16895, 0);
          }, createNode(a, b, c, d) {
            if (24576 === (c & 61440) || 4096 === (c & 61440)) throw new N(63);
            O.Za || (O.Za = { dir: { node: { Wa: O.La.Wa, Xa: O.La.Xa, mb: O.La.mb, rb: O.La.rb, Tb: O.La.Tb, xb: O.La.xb, vb: O.La.vb, Ib: O.La.Ib, wb: O.La.wb }, stream: { Ya: O.Ma.Ya } }, file: {
              node: { Wa: O.La.Wa, Xa: O.La.Xa },
              stream: { Ya: O.Ma.Ya, read: O.Ma.read, write: O.Ma.write, sb: O.Ma.sb, tb: O.Ma.tb }
            }, link: { node: { Wa: O.La.Wa, Xa: O.La.Xa, eb: O.La.eb }, stream: {} }, Nb: { node: { Wa: O.La.Wa, Xa: O.La.Xa }, stream: vb } });
            c = wb(a, b, c, d);
            P(c.mode) ? (c.La = O.Za.dir.node, c.Ma = O.Za.dir.stream, c.Na = {}) : 32768 === (c.mode & 61440) ? (c.La = O.Za.file.node, c.Ma = O.Za.file.stream, c.Ra = 0, c.Na = null) : 40960 === (c.mode & 61440) ? (c.La = O.Za.link.node, c.Ma = O.Za.link.stream) : 8192 === (c.mode & 61440) && (c.La = O.Za.Nb.node, c.Ma = O.Za.Nb.stream);
            c.$a = c.Ua = c.Ta = Date.now();
            a && (a.Na[b] = c, a.$a = a.Ua = a.Ta = c.$a);
            return c;
          }, Cc(a) {
            return a.Na ? a.Na.subarray ? a.Na.subarray(0, a.Ra) : new Uint8Array(a.Na) : new Uint8Array(0);
          }, La: { Wa(a) {
            var b = {};
            b.cc = 8192 === (a.mode & 61440) ? a.id : 1;
            b.oc = a.id;
            b.mode = a.mode;
            b.rc = 1;
            b.uid = 0;
            b.nc = 0;
            b.nb = a.nb;
            P(a.mode) ? b.size = 4096 : 32768 === (a.mode & 61440) ? b.size = a.Ra : 40960 === (a.mode & 61440) ? b.size = a.link.length : b.size = 0;
            b.$a = new Date(a.$a);
            b.Ua = new Date(a.Ua);
            b.Ta = new Date(a.Ta);
            b.Zb = 4096;
            b.$b = Math.ceil(b.size / b.Zb);
            return b;
          }, Xa(a, b) {
            for (var c of ["mode", "atime", "mtime", "ctime"]) null != b[c] && (a[c] = b[c]);
            void 0 !== b.size && (b = b.size, a.Ra != b && (0 == b ? (a.Na = null, a.Ra = 0) : (c = a.Na, a.Na = new Uint8Array(b), c && a.Na.set(c.subarray(0, Math.min(b, a.Ra))), a.Ra = b)));
          }, mb() {
            O.zb || (O.zb = new N(44), O.zb.stack = "<generic error, no stack>");
            throw O.zb;
          }, rb(a, b, c, d) {
            return O.createNode(a, b, c, d);
          }, Tb(a, b, c) {
            try {
              var d = Q(b, c);
            } catch (g) {
            }
            if (d) {
              if (P(a.mode)) for (var e in d.Na) throw new N(55);
              xb(d);
            }
            delete a.parent.Na[a.name];
            b.Na[c] = a;
            a.name = c;
            b.Ta = b.Ua = a.parent.Ta = a.parent.Ua = Date.now();
          }, xb(a, b) {
            delete a.Na[b];
            a.Ta = a.Ua = Date.now();
          }, vb(a, b) {
            var c = Q(a, b), d;
            for (d in c.Na) throw new N(55);
            delete a.Na[b];
            a.Ta = a.Ua = Date.now();
          }, Ib(a) {
            return [".", "..", ...Object.keys(a.Na)];
          }, wb(a, b, c) {
            a = O.createNode(a, b, 41471, 0);
            a.link = c;
            return a;
          }, eb(a) {
            if (40960 !== (a.mode & 61440)) throw new N(28);
            return a.link;
          } }, Ma: { read(a, b, c, d, e) {
            var g = a.node.Na;
            if (e >= a.node.Ra) return 0;
            a = Math.min(a.node.Ra - e, d);
            if (8 < a && g.subarray) b.set(g.subarray(e, e + a), c);
            else for (d = 0; d < a; d++) b[c + d] = g[e + d];
            return a;
          }, write(a, b, c, d, e, g) {
            b.buffer === m.buffer && (g = false);
            if (!d) return 0;
            a = a.node;
            a.Ua = a.Ta = Date.now();
            if (b.subarray && (!a.Na || a.Na.subarray)) {
              if (g) return a.Na = b.subarray(c, c + d), a.Ra = d;
              if (0 === a.Ra && 0 === e) return a.Na = b.slice(c, c + d), a.Ra = d;
              if (e + d <= a.Ra) return a.Na.set(b.subarray(c, c + d), e), d;
            }
            g = e + d;
            var h = a.Na ? a.Na.length : 0;
            h >= g || (g = Math.max(g, h * (1048576 > h ? 2 : 1.125) >>> 0), 0 != h && (g = Math.max(g, 256)), h = a.Na, a.Na = new Uint8Array(g), 0 < a.Ra && a.Na.set(h.subarray(0, a.Ra), 0));
            if (a.Na.subarray && b.subarray) a.Na.set(b.subarray(c, c + d), e);
            else for (g = 0; g < d; g++) a.Na[e + g] = b[c + g];
            a.Ra = Math.max(
              a.Ra,
              e + d
            );
            return d;
          }, Ya(a, b, c) {
            1 === c ? b += a.position : 2 === c && 32768 === (a.node.mode & 61440) && (b += a.node.Ra);
            if (0 > b) throw new N(28);
            return b;
          }, sb(a, b, c, d, e) {
            if (32768 !== (a.node.mode & 61440)) throw new N(43);
            a = a.node.Na;
            if (e & 2 || !a || a.buffer !== m.buffer) {
              e = true;
              d = 65536 * Math.ceil(b / 65536);
              var g = yb(65536, d);
              g && C.fill(0, g, g + d);
              d = g;
              if (!d) throw new N(48);
              if (a) {
                if (0 < c || c + b < a.length) a.subarray ? a = a.subarray(c, c + b) : a = Array.prototype.slice.call(a, c, c + b);
                m.set(a, d);
              }
            } else e = false, d = a.byteOffset;
            return { tc: d, Ub: e };
          }, tb(a, b, c, d) {
            O.Ma.write(
              a,
              b,
              0,
              d,
              c,
              false
            );
            return 0;
          } } }, ia = (a, b) => {
            var c = 0;
            a && (c |= 365);
            b && (c |= 146);
            return c;
          }, zb = null, Ab = {}, Bb = [], Cb = 1, R = null, Db = false, Eb = true, Fb = {}, N = class {
            name = "ErrnoError";
            constructor(a) {
              this.Pa = a;
            }
          }, Gb = class {
            qb = {};
            node = null;
            get flags() {
              return this.qb.flags;
            }
            set flags(a) {
              this.qb.flags = a;
            }
            get position() {
              return this.qb.position;
            }
            set position(a) {
              this.qb.position = a;
            }
          }, Hb = class {
            La = {};
            Ma = {};
            ib = null;
            constructor(a, b, c, d) {
              a ||= this;
              this.parent = a;
              this.ab = a.ab;
              this.id = Cb++;
              this.name = b;
              this.mode = c;
              this.nb = d;
              this.$a = this.Ua = this.Ta = Date.now();
            }
            get read() {
              return 365 === (this.mode & 365);
            }
            set read(a) {
              a ? this.mode |= 365 : this.mode &= -366;
            }
            get write() {
              return 146 === (this.mode & 146);
            }
            set write(a) {
              a ? this.mode |= 146 : this.mode &= -147;
            }
          };
          function S(a, b = {}) {
            if (!a) throw new N(44);
            b.Bb ?? (b.Bb = true);
            "/" === a.charAt(0) || (a = "//" + a);
            var c = 0;
            a: for (; 40 > c; c++) {
              a = a.split("/").filter((q) => !!q);
              for (var d = zb, e = "/", g = 0; g < a.length; g++) {
                var h = g === a.length - 1;
                if (h && b.parent) break;
                if ("." !== a[g]) if (".." === a[g]) if (e = Za(e), d === d.parent) {
                  a = e + "/" + a.slice(g + 1).join("/");
                  c--;
                  continue a;
                } else d = d.parent;
                else {
                  e = ha(e + "/" + a[g]);
                  try {
                    d = Q(d, a[g]);
                  } catch (q) {
                    if (44 === q?.Pa && h && b.sc) return { path: e };
                    throw q;
                  }
                  !d.ib || h && !b.Bb || (d = d.ib.root);
                  if (40960 === (d.mode & 61440) && (!h || b.hb)) {
                    if (!d.La.eb) throw new N(52);
                    d = d.La.eb(d);
                    "/" === d.charAt(0) || (d = Za(e) + "/" + d);
                    a = d + "/" + a.slice(g + 1).join("/");
                    continue a;
                  }
                }
              }
              return { path: e, node: d };
            }
            throw new N(32);
          }
          function fa(a) {
            for (var b; ; ) {
              if (a === a.parent) return a = a.ab.Sb, b ? "/" !== a[a.length - 1] ? `${a}/${b}` : a + b : a;
              b = b ? `${a.name}/${b}` : a.name;
              a = a.parent;
            }
          }
          function Ib(a, b) {
            for (var c = 0, d = 0; d < b.length; d++) c = (c << 5) - c + b.charCodeAt(d) | 0;
            return (a + c >>> 0) % R.length;
          }
          function xb(a) {
            var b = Ib(a.parent.id, a.name);
            if (R[b] === a) R[b] = a.jb;
            else for (b = R[b]; b; ) {
              if (b.jb === a) {
                b.jb = a.jb;
                break;
              }
              b = b.jb;
            }
          }
          function Q(a, b) {
            var c = P(a.mode) ? (c = Jb(a, "x")) ? c : a.La.mb ? 0 : 2 : 54;
            if (c) throw new N(c);
            for (c = R[Ib(a.id, b)]; c; c = c.jb) {
              var d = c.name;
              if (c.parent.id === a.id && d === b) return c;
            }
            return a.La.mb(a, b);
          }
          function wb(a, b, c, d) {
            a = new Hb(a, b, c, d);
            b = Ib(a.parent.id, a.name);
            a.jb = R[b];
            return R[b] = a;
          }
          function P(a) {
            return 16384 === (a & 61440);
          }
          function Kb(a) {
            var b = ["r", "w", "rw"][a & 3];
            a & 512 && (b += "w");
            return b;
          }
          function Jb(a, b) {
            if (Eb) return 0;
            if (!b.includes("r") || a.mode & 292) {
              if (b.includes("w") && !(a.mode & 146) || b.includes("x") && !(a.mode & 73)) return 2;
            } else return 2;
            return 0;
          }
          function Lb(a, b) {
            if (!P(a.mode)) return 54;
            try {
              return Q(a, b), 20;
            } catch (c) {
            }
            return Jb(a, "wx");
          }
          function Mb(a, b, c) {
            try {
              var d = Q(a, b);
            } catch (e) {
              return e.Pa;
            }
            if (a = Jb(a, "wx")) return a;
            if (c) {
              if (!P(d.mode)) return 54;
              if (d === d.parent || "/" === fa(d)) return 10;
            } else if (P(d.mode)) return 31;
            return 0;
          }
          function Nb(a) {
            if (!a) throw new N(63);
            return a;
          }
          function T(a) {
            a = Bb[a];
            if (!a) throw new N(8);
            return a;
          }
          function Ob(a, b = -1) {
            a = Object.assign(new Gb(), a);
            if (-1 == b) a: {
              for (b = 0; 4096 >= b; b++) if (!Bb[b]) break a;
              throw new N(33);
            }
            a.bb = b;
            return Bb[b] = a;
          }
          function Pb(a, b = -1) {
            a = Ob(a, b);
            a.Ma?.Bc?.(a);
            return a;
          }
          function Qb(a, b, c) {
            var d = a?.Ma.Xa;
            a = d ? a : b;
            d ??= b.La.Xa;
            Nb(d);
            d(a, c);
          }
          var vb = { open(a) {
            a.Ma = Ab[a.node.nb].Ma;
            a.Ma.open?.(a);
          }, Ya() {
            throw new N(70);
          } };
          function rb(a, b) {
            Ab[a] = { Ma: b };
          }
          function Rb(a, b) {
            var c = "/" === b;
            if (c && zb) throw new N(10);
            if (!c && b) {
              var d = S(b, { Bb: false });
              b = d.path;
              d = d.node;
              if (d.ib) throw new N(10);
              if (!P(d.mode)) throw new N(54);
            }
            b = { type: a, Gc: {}, Sb: b, qc: [] };
            a = a.ab(b);
            a.ab = b;
            b.root = a;
            c ? zb = a : d && (d.ib = b, d.ab && d.ab.qc.push(b));
          }
          function Sb(a, b, c) {
            var d = S(a, { parent: true }).node;
            a = $a(a);
            if (!a) throw new N(28);
            if ("." === a || ".." === a) throw new N(20);
            var e = Lb(d, a);
            if (e) throw new N(e);
            if (!d.La.rb) throw new N(63);
            return d.La.rb(d, a, b, c);
          }
          function ja(a, b = 438) {
            return Sb(a, b & 4095 | 32768, 0);
          }
          function U(a, b = 511) {
            return Sb(a, b & 1023 | 16384, 0);
          }
          function Tb(a, b, c) {
            "undefined" == typeof c && (c = b, b = 438);
            Sb(a, b | 8192, c);
          }
          function Ub(a, b) {
            if (!cb(a)) throw new N(44);
            var c = S(b, { parent: true }).node;
            if (!c) throw new N(44);
            b = $a(b);
            var d = Lb(c, b);
            if (d) throw new N(d);
            if (!c.La.wb) throw new N(63);
            c.La.wb(c, b, a);
          }
          function Vb(a) {
            var b = S(a, { parent: true }).node;
            a = $a(a);
            var c = Q(b, a), d = Mb(b, a, true);
            if (d) throw new N(d);
            if (!b.La.vb) throw new N(63);
            if (c.ib) throw new N(10);
            b.La.vb(b, a);
            xb(c);
          }
          function ta(a) {
            var b = S(a, { parent: true }).node;
            if (!b) throw new N(44);
            a = $a(a);
            var c = Q(b, a), d = Mb(b, a, false);
            if (d) throw new N(d);
            if (!b.La.xb) throw new N(63);
            if (c.ib) throw new N(10);
            b.La.xb(b, a);
            xb(c);
          }
          function Wb(a, b) {
            a = S(a, { hb: !b }).node;
            return Nb(a.La.Wa)(a);
          }
          function Xb(a, b, c, d) {
            Qb(a, b, { mode: c & 4095 | b.mode & -4096, Ta: Date.now(), dc: d });
          }
          function ka(a, b) {
            a = "string" == typeof a ? S(a, { hb: true }).node : a;
            Xb(null, a, b);
          }
          function Yb(a, b, c) {
            if (P(b.mode)) throw new N(31);
            if (32768 !== (b.mode & 61440)) throw new N(28);
            var d = Jb(b, "w");
            if (d) throw new N(d);
            Qb(a, b, { size: c, timestamp: Date.now() });
          }
          function ma(a, b, c = 438) {
            if ("" === a) throw new N(44);
            if ("string" == typeof b) {
              var d = { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 }[b];
              if ("undefined" == typeof d) throw Error(`Unknown file open mode: ${b}`);
              b = d;
            }
            c = b & 64 ? c & 4095 | 32768 : 0;
            if ("object" == typeof a) d = a;
            else {
              var e = a.endsWith("/");
              a = S(a, { hb: !(b & 131072), sc: true });
              d = a.node;
              a = a.path;
            }
            var g = false;
            if (b & 64) if (d) {
              if (b & 128) throw new N(20);
            } else {
              if (e) throw new N(31);
              d = Sb(a, c | 511, 0);
              g = true;
            }
            if (!d) throw new N(44);
            8192 === (d.mode & 61440) && (b &= -513);
            if (b & 65536 && !P(d.mode)) throw new N(54);
            if (!g && (e = d ? 40960 === (d.mode & 61440) ? 32 : P(d.mode) && ("r" !== Kb(b) || b & 576) ? 31 : Jb(d, Kb(b)) : 44)) throw new N(e);
            b & 512 && !g && (e = d, e = "string" == typeof e ? S(e, { hb: true }).node : e, Yb(null, e, 0));
            b &= -131713;
            e = Ob({ node: d, path: fa(d), flags: b, seekable: true, position: 0, Ma: d.Ma, uc: [], error: false });
            e.Ma.open && e.Ma.open(e);
            g && ka(d, c & 511);
            !k.logReadFiles || b & 1 || a in Fb || (Fb[a] = 1);
            return e;
          }
          function oa(a) {
            if (null === a.bb) throw new N(8);
            a.Eb && (a.Eb = null);
            try {
              a.Ma.close && a.Ma.close(a);
            } catch (b) {
              throw b;
            } finally {
              Bb[a.bb] = null;
            }
            a.bb = null;
          }
          function Zb(a, b, c) {
            if (null === a.bb) throw new N(8);
            if (!a.seekable || !a.Ma.Ya) throw new N(70);
            if (0 != c && 1 != c && 2 != c) throw new N(28);
            a.position = a.Ma.Ya(a, b, c);
            a.uc = [];
          }
          function $b(a, b, c, d, e) {
            if (0 > d || 0 > e) throw new N(28);
            if (null === a.bb) throw new N(8);
            if (1 === (a.flags & 2097155)) throw new N(8);
            if (P(a.node.mode)) throw new N(31);
            if (!a.Ma.read) throw new N(28);
            var g = "undefined" != typeof e;
            if (!g) e = a.position;
            else if (!a.seekable) throw new N(70);
            b = a.Ma.read(a, b, c, d, e);
            g || (a.position += b);
            return b;
          }
          function na(a, b, c, d, e) {
            if (0 > d || 0 > e) throw new N(28);
            if (null === a.bb) throw new N(8);
            if (0 === (a.flags & 2097155)) throw new N(8);
            if (P(a.node.mode)) throw new N(31);
            if (!a.Ma.write) throw new N(28);
            a.seekable && a.flags & 1024 && Zb(a, 0, 2);
            var g = "undefined" != typeof e;
            if (!g) e = a.position;
            else if (!a.seekable) throw new N(70);
            b = a.Ma.write(a, b, c, d, e, void 0);
            g || (a.position += b);
            return b;
          }
          function sa(a) {
            var b = b || 0;
            var c = "binary";
            "utf8" !== c && "binary" !== c && Ka(`Invalid encoding type "${c}"`);
            b = ma(a, b);
            a = Wb(a).size;
            var d = new Uint8Array(a);
            $b(b, d, 0, a, 0);
            "utf8" === c && (d = db(d));
            oa(b);
            return d;
          }
          function W(a, b, c) {
            a = ha("/dev/" + a);
            var d = ia(!!b, !!c);
            W.Rb ?? (W.Rb = 64);
            var e = W.Rb++ << 8 | 0;
            rb(e, { open(g) {
              g.seekable = false;
            }, close() {
              c?.buffer?.length && c(10);
            }, read(g, h, q, w) {
              for (var u = 0, x = 0; x < w; x++) {
                try {
                  var D = b();
                } catch (ib) {
                  throw new N(29);
                }
                if (void 0 === D && 0 === u) throw new N(6);
                if (null === D || void 0 === D) break;
                u++;
                h[q + x] = D;
              }
              u && (g.node.$a = Date.now());
              return u;
            }, write(g, h, q, w) {
              for (var u = 0; u < w; u++) try {
                c(h[q + u]);
              } catch (x) {
                throw new N(29);
              }
              w && (g.node.Ua = g.node.Ta = Date.now());
              return u;
            } });
            Tb(a, d, e);
          }
          var X = {};
          function Y(a, b, c) {
            if ("/" === b.charAt(0)) return b;
            a = -100 === a ? "/" : T(a).path;
            if (0 == b.length) {
              if (!c) throw new N(44);
              return a;
            }
            return a + "/" + b;
          }
          function ac(a, b) {
            F[a >> 2] = b.cc;
            F[a + 4 >> 2] = b.mode;
            F[a + 8 >> 2] = b.rc;
            F[a + 12 >> 2] = b.uid;
            F[a + 16 >> 2] = b.nc;
            F[a + 20 >> 2] = b.nb;
            H[a + 24 >> 3] = BigInt(b.size);
            E[a + 32 >> 2] = 4096;
            E[a + 36 >> 2] = b.$b;
            var c = b.$a.getTime(), d = b.Ua.getTime(), e = b.Ta.getTime();
            H[a + 40 >> 3] = BigInt(Math.floor(c / 1e3));
            F[a + 48 >> 2] = c % 1e3 * 1e6;
            H[a + 56 >> 3] = BigInt(Math.floor(d / 1e3));
            F[a + 64 >> 2] = d % 1e3 * 1e6;
            H[a + 72 >> 3] = BigInt(Math.floor(e / 1e3));
            F[a + 80 >> 2] = e % 1e3 * 1e6;
            H[a + 88 >> 3] = BigInt(b.oc);
            return 0;
          }
          var kc = void 0, Cc = () => {
            var a = E[+kc >> 2];
            kc += 4;
            return a;
          }, Ec = 0, Fc = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], Gc = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], Hc = {}, Ic = (a) => {
            if (!(a instanceof Pa || "unwind" == a)) throw a;
          }, Jc = (a) => {
            Ea = a;
            Va || 0 < Ec || (k.onExit?.(a), Da = true);
            throw new Pa(a);
          }, Kc = (a) => {
            if (!Da) try {
              a();
            } catch (b) {
              Ic(b);
            } finally {
              if (!(Va || 0 < Ec)) try {
                Ea = a = Ea, Jc(a);
              } catch (b) {
                Ic(b);
              }
            }
          }, Lc = {}, Nc = () => {
            if (!Mc) {
              var a = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8", _: wa || "./this.program" }, b;
              for (b in Lc) void 0 === Lc[b] ? delete a[b] : a[b] = Lc[b];
              var c = [];
              for (b in a) c.push(`${b}=${a[b]}`);
              Mc = c;
            }
            return Mc;
          }, Mc, Oc = (a, b, c, d) => {
            var e = { string: (u) => {
              var x = 0;
              if (null !== u && void 0 !== u && 0 !== u) {
                x = gb(u) + 1;
                var D = y(x);
                M(u, C, D, x);
                x = D;
              }
              return x;
            }, array: (u) => {
              var x = y(u.length);
              m.set(u, x);
              return x;
            } };
            a = k["_" + a];
            var g = [], h = 0;
            if (d) for (var q = 0; q < d.length; q++) {
              var w = e[c[q]];
              w ? (0 === h && (h = pa()), g[q] = w(d[q])) : g[q] = d[q];
            }
            c = a(...g);
            return c = (function(u) {
              0 !== h && ra(h);
              return "string" === b ? z(u) : "boolean" === b ? !!u : u;
            })(c);
          }, ea = (a) => {
            var b = gb(a) + 1, c = ca(b);
            c && M(a, C, c, b);
            return c;
          }, Pc, Qc = [], A = (a) => {
            Pc.delete(Z.get(a));
            Z.set(a, null);
            Qc.push(a);
          }, Rc = (a) => {
            const b = a.length;
            return [b % 128 | 128, b >> 7, ...a];
          }, Sc = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 }, Tc = (a) => Rc(Array.from(a, (b) => Sc[b])), va = (a, b) => {
            if (!Pc) {
              Pc = /* @__PURE__ */ new WeakMap();
              var c = Z.length;
              if (Pc) for (var d = 0; d < 0 + c; d++) {
                var e = Z.get(d);
                e && Pc.set(e, d);
              }
            }
            if (c = Pc.get(a) || 0) return c;
            c = Qc.length ? Qc.pop() : Z.grow(1);
            try {
              Z.set(c, a);
            } catch (g) {
              if (!(g instanceof TypeError)) throw g;
              b = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1, ...Rc([1, 96, ...Tc(b.slice(1)), ...Tc("v" === b[0] ? "" : b[0])]), 2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
              b = new WebAssembly.Module(b);
              b = new WebAssembly.Instance(b, { e: { f: a } }).exports.f;
              Z.set(c, b);
            }
            Pc.set(a, c);
            return c;
          };
          R = Array(4096);
          Rb(O, "/");
          U("/tmp");
          U("/home");
          U("/home/web_user");
          (function() {
            U("/dev");
            rb(259, { read: () => 0, write: (d, e, g, h) => h, Ya: () => 0 });
            Tb("/dev/null", 259);
            qb(1280, tb);
            qb(1536, ub);
            Tb("/dev/tty", 1280);
            Tb("/dev/tty1", 1536);
            var a = new Uint8Array(1024), b = 0, c = () => {
              0 === b && (bb(a), b = a.byteLength);
              return a[--b];
            };
            W("random", c);
            W("urandom", c);
            U("/dev/shm");
            U("/dev/shm/tmp");
          })();
          (function() {
            U("/proc");
            var a = U("/proc/self");
            U("/proc/self/fd");
            Rb({ ab() {
              var b = wb(a, "fd", 16895, 73);
              b.Ma = { Ya: O.Ma.Ya };
              b.La = { mb(c, d) {
                c = +d;
                var e = T(c);
                c = { parent: null, ab: { Sb: "fake" }, La: { eb: () => e.path }, id: c + 1 };
                return c.parent = c;
              }, Ib() {
                return Array.from(Bb.entries()).filter(([, c]) => c).map(([c]) => c.toString());
              } };
              return b;
            } }, "/proc/self/fd");
          })();
          k.noExitRuntime && (Va = k.noExitRuntime);
          k.print && (Ba = k.print);
          k.printErr && (B = k.printErr);
          k.wasmBinary && (Ca = k.wasmBinary);
          k.thisProgram && (wa = k.thisProgram);
          if (k.preInit) for ("function" == typeof k.preInit && (k.preInit = [k.preInit]); 0 < k.preInit.length; ) k.preInit.shift()();
          k.stackSave = () => pa();
          k.stackRestore = (a) => ra(a);
          k.stackAlloc = (a) => y(a);
          k.cwrap = (a, b, c, d) => {
            var e = !c || c.every((g) => "number" === g || "boolean" === g);
            return "string" !== b && e && !d ? k["_" + a] : (...g) => Oc(a, b, c, g);
          };
          k.addFunction = va;
          k.removeFunction = A;
          k.UTF8ToString = z;
          k.stringToNewUTF8 = ea;
          k.writeArrayToMemory = (a, b) => {
            m.set(a, b);
          };
          var ca, da, yb, Uc, ra, y, pa, Ja, Z, Vc = {
            a: (a, b, c, d) => Ka(`Assertion failed: ${z(a)}, at: ` + [b ? z(b) : "unknown filename", c, d ? z(d) : "unknown function"]),
            i: function(a, b) {
              try {
                return a = z(a), ka(a, b), 0;
              } catch (c) {
                if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
                return -c.Pa;
              }
            },
            L: function(a, b, c) {
              try {
                b = z(b);
                b = Y(a, b);
                if (c & -8) return -28;
                var d = S(b, { hb: true }).node;
                if (!d) return -44;
                a = "";
                c & 4 && (a += "r");
                c & 2 && (a += "w");
                c & 1 && (a += "x");
                return a && Jb(d, a) ? -2 : 0;
              } catch (e) {
                if ("undefined" == typeof X || "ErrnoError" !== e.name) throw e;
                return -e.Pa;
              }
            },
            j: function(a, b) {
              try {
                var c = T(a);
                Xb(c, c.node, b, false);
                return 0;
              } catch (d) {
                if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
                return -d.Pa;
              }
            },
            h: function(a) {
              try {
                var b = T(a);
                Qb(b, b.node, { timestamp: Date.now(), dc: false });
                return 0;
              } catch (c) {
                if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
                return -c.Pa;
              }
            },
            b: function(a, b, c) {
              kc = c;
              try {
                var d = T(a);
                switch (b) {
                  case 0:
                    var e = Cc();
                    if (0 > e) break;
                    for (; Bb[e]; ) e++;
                    return Pb(d, e).bb;
                  case 1:
                  case 2:
                    return 0;
                  case 3:
                    return d.flags;
                  case 4:
                    return e = Cc(), d.flags |= e, 0;
                  case 12:
                    return e = Cc(), Fa[e + 0 >> 1] = 2, 0;
                  case 13:
                  case 14:
                    return 0;
                }
                return -28;
              } catch (g) {
                if ("undefined" == typeof X || "ErrnoError" !== g.name) throw g;
                return -g.Pa;
              }
            },
            g: function(a, b) {
              try {
                var c = T(a), d = c.node, e = c.Ma.Wa;
                a = e ? c : d;
                e ??= d.La.Wa;
                Nb(e);
                var g = e(a);
                return ac(b, g);
              } catch (h) {
                if ("undefined" == typeof X || "ErrnoError" !== h.name) throw h;
                return -h.Pa;
              }
            },
            H: function(a, b) {
              b = -9007199254740992 > b || 9007199254740992 < b ? NaN : Number(b);
              try {
                if (isNaN(b)) return -61;
                var c = T(a);
                if (0 > b || 0 === (c.flags & 2097155)) throw new N(28);
                Yb(c, c.node, b);
                return 0;
              } catch (d) {
                if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
                return -d.Pa;
              }
            },
            G: function(a, b) {
              try {
                if (0 === b) return -28;
                var c = gb("/") + 1;
                if (b < c) return -68;
                M("/", C, a, b);
                return c;
              } catch (d) {
                if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
                return -d.Pa;
              }
            },
            K: function(a, b) {
              try {
                return a = z(a), ac(b, Wb(a, true));
              } catch (c) {
                if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
                return -c.Pa;
              }
            },
            C: function(a, b, c) {
              try {
                return b = z(b), b = Y(a, b), U(b, c), 0;
              } catch (d) {
                if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
                return -d.Pa;
              }
            },
            J: function(a, b, c, d) {
              try {
                b = z(b);
                var e = d & 256;
                b = Y(a, b, d & 4096);
                return ac(c, e ? Wb(b, true) : Wb(b));
              } catch (g) {
                if ("undefined" == typeof X || "ErrnoError" !== g.name) throw g;
                return -g.Pa;
              }
            },
            x: function(a, b, c, d) {
              kc = d;
              try {
                b = z(b);
                b = Y(a, b);
                var e = d ? Cc() : 0;
                return ma(b, c, e).bb;
              } catch (g) {
                if ("undefined" == typeof X || "ErrnoError" !== g.name) throw g;
                return -g.Pa;
              }
            },
            v: function(a, b, c, d) {
              try {
                b = z(b);
                b = Y(a, b);
                if (0 >= d) return -28;
                var e = S(b).node;
                if (!e) throw new N(44);
                if (!e.La.eb) throw new N(28);
                var g = e.La.eb(e);
                var h = Math.min(d, gb(g)), q = m[c + h];
                M(g, C, c, d + 1);
                m[c + h] = q;
                return h;
              } catch (w) {
                if ("undefined" == typeof X || "ErrnoError" !== w.name) throw w;
                return -w.Pa;
              }
            },
            u: function(a) {
              try {
                return a = z(a), Vb(a), 0;
              } catch (b) {
                if ("undefined" == typeof X || "ErrnoError" !== b.name) throw b;
                return -b.Pa;
              }
            },
            f: function(a, b) {
              try {
                return a = z(a), ac(b, Wb(a));
              } catch (c) {
                if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
                return -c.Pa;
              }
            },
            r: function(a, b, c) {
              try {
                b = z(b);
                b = Y(a, b);
                if (c) if (512 === c) Vb(b);
                else return -28;
                else ta(b);
                return 0;
              } catch (d) {
                if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
                return -d.Pa;
              }
            },
            q: function(a, b, c) {
              try {
                b = z(b);
                b = Y(a, b, true);
                var d = Date.now(), e, g;
                if (c) {
                  var h = F[c >> 2] + 4294967296 * E[c + 4 >> 2], q = E[c + 8 >> 2];
                  1073741823 == q ? e = d : 1073741822 == q ? e = null : e = 1e3 * h + q / 1e6;
                  c += 16;
                  h = F[c >> 2] + 4294967296 * E[c + 4 >> 2];
                  q = E[c + 8 >> 2];
                  1073741823 == q ? g = d : 1073741822 == q ? g = null : g = 1e3 * h + q / 1e6;
                } else g = e = d;
                if (null !== (g ?? e)) {
                  a = e;
                  var w = S(b, { hb: true }).node;
                  Nb(w.La.Xa)(w, { $a: a, Ua: g });
                }
                return 0;
              } catch (u) {
                if ("undefined" == typeof X || "ErrnoError" !== u.name) throw u;
                return -u.Pa;
              }
            },
            m: () => Ka(""),
            l: () => {
              Va = false;
              Ec = 0;
            },
            A: function(a, b) {
              a = -9007199254740992 > a || 9007199254740992 < a ? NaN : Number(a);
              a = new Date(1e3 * a);
              E[b >> 2] = a.getSeconds();
              E[b + 4 >> 2] = a.getMinutes();
              E[b + 8 >> 2] = a.getHours();
              E[b + 12 >> 2] = a.getDate();
              E[b + 16 >> 2] = a.getMonth();
              E[b + 20 >> 2] = a.getFullYear() - 1900;
              E[b + 24 >> 2] = a.getDay();
              var c = a.getFullYear();
              E[b + 28 >> 2] = (0 !== c % 4 || 0 === c % 100 && 0 !== c % 400 ? Gc : Fc)[a.getMonth()] + a.getDate() - 1 | 0;
              E[b + 36 >> 2] = -(60 * a.getTimezoneOffset());
              c = new Date(a.getFullYear(), 6, 1).getTimezoneOffset();
              var d = new Date(a.getFullYear(), 0, 1).getTimezoneOffset();
              E[b + 32 >> 2] = (c != d && a.getTimezoneOffset() == Math.min(d, c)) | 0;
            },
            y: function(a, b, c, d, e, g, h) {
              e = -9007199254740992 > e || 9007199254740992 < e ? NaN : Number(e);
              try {
                var q = T(d);
                if (0 !== (b & 2) && 0 === (c & 2) && 2 !== (q.flags & 2097155)) throw new N(2);
                if (1 === (q.flags & 2097155)) throw new N(2);
                if (!q.Ma.sb) throw new N(43);
                if (!a) throw new N(28);
                var w = q.Ma.sb(q, a, e, b, c);
                var u = w.tc;
                E[g >> 2] = w.Ub;
                F[h >> 2] = u;
                return 0;
              } catch (x) {
                if ("undefined" == typeof X || "ErrnoError" !== x.name) throw x;
                return -x.Pa;
              }
            },
            z: function(a, b, c, d, e, g) {
              g = -9007199254740992 > g || 9007199254740992 < g ? NaN : Number(g);
              try {
                var h = T(e);
                if (c & 2) {
                  if (32768 !== (h.node.mode & 61440)) throw new N(43);
                  d & 2 || h.Ma.tb && h.Ma.tb(h, C.slice(a, a + b), g, b, d);
                }
              } catch (q) {
                if ("undefined" == typeof X || "ErrnoError" !== q.name) throw q;
                return -q.Pa;
              }
            },
            n: (a, b) => {
              Hc[a] && (clearTimeout(Hc[a].id), delete Hc[a]);
              if (!b) return 0;
              var c = setTimeout(() => {
                delete Hc[a];
                Kc(() => Uc(a, performance.now()));
              }, b);
              Hc[a] = { id: c, Hc: b };
              return 0;
            },
            B: (a, b, c, d) => {
              var e = (/* @__PURE__ */ new Date()).getFullYear(), g = new Date(e, 0, 1).getTimezoneOffset();
              e = new Date(e, 6, 1).getTimezoneOffset();
              F[a >> 2] = 60 * Math.max(g, e);
              E[b >> 2] = Number(g != e);
              b = (h) => {
                var q = Math.abs(h);
                return `UTC${0 <= h ? "-" : "+"}${String(Math.floor(q / 60)).padStart(2, "0")}${String(q % 60).padStart(2, "0")}`;
              };
              a = b(g);
              b = b(e);
              e < g ? (M(a, C, c, 17), M(b, C, d, 17)) : (M(a, C, d, 17), M(b, C, c, 17));
            },
            d: () => Date.now(),
            s: () => 2147483648,
            c: () => performance.now(),
            o: (a) => {
              var b = C.length;
              a >>>= 0;
              if (2147483648 < a) return false;
              for (var c = 1; 4 >= c; c *= 2) {
                var d = b * (1 + 0.2 / c);
                d = Math.min(d, a + 100663296);
                a: {
                  d = (Math.min(2147483648, 65536 * Math.ceil(Math.max(a, d) / 65536)) - Ja.buffer.byteLength + 65535) / 65536 | 0;
                  try {
                    Ja.grow(d);
                    Ia();
                    var e = 1;
                    break a;
                  } catch (g) {
                  }
                  e = void 0;
                }
                if (e) return true;
              }
              return false;
            },
            E: (a, b) => {
              var c = 0, d = 0, e;
              for (e of Nc()) {
                var g = b + c;
                F[a + d >> 2] = g;
                c += M(e, C, g, Infinity) + 1;
                d += 4;
              }
              return 0;
            },
            F: (a, b) => {
              var c = Nc();
              F[a >> 2] = c.length;
              a = 0;
              for (var d of c) a += gb(d) + 1;
              F[b >> 2] = a;
              return 0;
            },
            e: function(a) {
              try {
                var b = T(a);
                oa(b);
                return 0;
              } catch (c) {
                if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
                return c.Pa;
              }
            },
            p: function(a, b) {
              try {
                var c = T(a);
                m[b] = c.Va ? 2 : P(c.mode) ? 3 : 40960 === (c.mode & 61440) ? 7 : 4;
                Fa[b + 2 >> 1] = 0;
                H[b + 8 >> 3] = BigInt(0);
                H[b + 16 >> 3] = BigInt(0);
                return 0;
              } catch (d) {
                if ("undefined" == typeof X || "ErrnoError" !== d.name) throw d;
                return d.Pa;
              }
            },
            w: function(a, b, c, d) {
              try {
                a: {
                  var e = T(a);
                  a = b;
                  for (var g, h = b = 0; h < c; h++) {
                    var q = F[a >> 2], w = F[a + 4 >> 2];
                    a += 8;
                    var u = $b(e, m, q, w, g);
                    if (0 > u) {
                      var x = -1;
                      break a;
                    }
                    b += u;
                    if (u < w) break;
                    "undefined" != typeof g && (g += u);
                  }
                  x = b;
                }
                F[d >> 2] = x;
                return 0;
              } catch (D) {
                if ("undefined" == typeof X || "ErrnoError" !== D.name) throw D;
                return D.Pa;
              }
            },
            D: function(a, b, c, d) {
              b = -9007199254740992 > b || 9007199254740992 < b ? NaN : Number(b);
              try {
                if (isNaN(b)) return 61;
                var e = T(a);
                Zb(e, b, c);
                H[d >> 3] = BigInt(e.position);
                e.Eb && 0 === b && 0 === c && (e.Eb = null);
                return 0;
              } catch (g) {
                if ("undefined" == typeof X || "ErrnoError" !== g.name) throw g;
                return g.Pa;
              }
            },
            I: function(a) {
              try {
                var b = T(a);
                return b.Ma?.lb?.(b);
              } catch (c) {
                if ("undefined" == typeof X || "ErrnoError" !== c.name) throw c;
                return c.Pa;
              }
            },
            t: function(a, b, c, d) {
              try {
                a: {
                  var e = T(a);
                  a = b;
                  for (var g, h = b = 0; h < c; h++) {
                    var q = F[a >> 2], w = F[a + 4 >> 2];
                    a += 8;
                    var u = na(e, m, q, w, g);
                    if (0 > u) {
                      var x = -1;
                      break a;
                    }
                    b += u;
                    if (u < w) break;
                    "undefined" != typeof g && (g += u);
                  }
                  x = b;
                }
                F[d >> 2] = x;
                return 0;
              } catch (D) {
                if ("undefined" == typeof X || "ErrnoError" !== D.name) throw D;
                return D.Pa;
              }
            },
            k: Jc
          };
          function Wc() {
            function a() {
              k.calledRun = true;
              if (!Da) {
                if (!k.noFSInit && !Db) {
                  var b, c;
                  Db = true;
                  b ??= k.stdin;
                  c ??= k.stdout;
                  d ??= k.stderr;
                  b ? W("stdin", b) : Ub("/dev/tty", "/dev/stdin");
                  c ? W("stdout", null, c) : Ub("/dev/tty", "/dev/stdout");
                  d ? W("stderr", null, d) : Ub("/dev/tty1", "/dev/stderr");
                  ma("/dev/stdin", 0);
                  ma("/dev/stdout", 1);
                  ma("/dev/stderr", 1);
                }
                Xc.N();
                Eb = false;
                k.onRuntimeInitialized?.();
                if (k.postRun) for ("function" == typeof k.postRun && (k.postRun = [k.postRun]); k.postRun.length; ) {
                  var d = k.postRun.shift();
                  Ra.push(d);
                }
                Qa(Ra);
              }
            }
            if (0 < K) Ua = Wc;
            else {
              if (k.preRun) for ("function" == typeof k.preRun && (k.preRun = [k.preRun]); k.preRun.length; ) Ta();
              Qa(Sa);
              0 < K ? Ua = Wc : k.setStatus ? (k.setStatus("Running..."), setTimeout(() => {
                setTimeout(() => k.setStatus(""), 1);
                a();
              }, 1)) : a();
            }
          }
          var Xc;
          (async function() {
            function a(c) {
              c = Xc = c.exports;
              k._sqlite3_free = c.P;
              k._sqlite3_value_text = c.Q;
              k._sqlite3_prepare_v2 = c.R;
              k._sqlite3_step = c.S;
              k._sqlite3_reset = c.T;
              k._sqlite3_exec = c.U;
              k._sqlite3_finalize = c.V;
              k._sqlite3_column_name = c.W;
              k._sqlite3_column_text = c.X;
              k._sqlite3_column_type = c.Y;
              k._sqlite3_errmsg = c.Z;
              k._sqlite3_clear_bindings = c._;
              k._sqlite3_value_blob = c.$;
              k._sqlite3_value_bytes = c.aa;
              k._sqlite3_value_double = c.ba;
              k._sqlite3_value_int = c.ca;
              k._sqlite3_value_type = c.da;
              k._sqlite3_result_blob = c.ea;
              k._sqlite3_result_double = c.fa;
              k._sqlite3_result_error = c.ga;
              k._sqlite3_result_int = c.ha;
              k._sqlite3_result_int64 = c.ia;
              k._sqlite3_result_null = c.ja;
              k._sqlite3_result_text = c.ka;
              k._sqlite3_aggregate_context = c.la;
              k._sqlite3_column_count = c.ma;
              k._sqlite3_data_count = c.na;
              k._sqlite3_column_blob = c.oa;
              k._sqlite3_column_bytes = c.pa;
              k._sqlite3_column_double = c.qa;
              k._sqlite3_bind_blob = c.ra;
              k._sqlite3_bind_double = c.sa;
              k._sqlite3_bind_int = c.ta;
              k._sqlite3_bind_text = c.ua;
              k._sqlite3_bind_parameter_index = c.va;
              k._sqlite3_sql = c.wa;
              k._sqlite3_normalized_sql = c.xa;
              k._sqlite3_changes = c.ya;
              k._sqlite3_close_v2 = c.za;
              k._sqlite3_create_function_v2 = c.Aa;
              k._sqlite3_update_hook = c.Ba;
              k._sqlite3_open = c.Ca;
              ca = k._malloc = c.Da;
              da = k._free = c.Ea;
              k._RegisterExtensionFunctions = c.Fa;
              yb = c.Ga;
              Uc = c.Ha;
              ra = c.Ia;
              y = c.Ja;
              pa = c.Ka;
              Ja = c.M;
              Z = c.O;
              Ia();
              K--;
              k.monitorRunDependencies?.(K);
              0 == K && Ua && (c = Ua, Ua = null, c());
              return Xc;
            }
            K++;
            k.monitorRunDependencies?.(K);
            var b = { a: Vc };
            if (k.instantiateWasm) return new Promise((c) => {
              k.instantiateWasm(b, (d, e) => {
                c(a(d, e));
              });
            });
            La ??= k.locateFile ? k.locateFile("sql-wasm-browser.wasm", ya) : ya + "sql-wasm-browser.wasm";
            return a((await Oa(b)).instance);
          })();
          Wc();
          return Module;
        });
        return initSqlJsPromise;
      };
      if (typeof exports === "object" && typeof module === "object") {
        module.exports = initSqlJs2;
        module.exports.default = initSqlJs2;
      } else if (typeof define === "function" && define["amd"]) {
        define([], function() {
          return initSqlJs2;
        });
      } else if (typeof exports === "object") {
        exports["Module"] = initSqlJs2;
      }
    }
  });

  // cxobra/mantenimiento/fuente/datos/base-wasm.ts
  var import_sql = __toESM(require_sql_wasm_browser());

  // cxobra/mantenimiento/fuente/datos/esquema.ts
  var ESPEJO = [
    { nombre: "organizaciones", columnas: ["nombre", "tipos", "cert_empresa_fgas", "registro_empresa_rite", "idioma"], json: ["tipos"], alcance: { tipo: "global" } },
    { nombre: "perfiles", columnas: ["nombre_completo", "idioma"], alcance: { tipo: "global", filtro: "usuario" } },
    { nombre: "miembros", columnas: ["organizacion_id", "usuario_id", "rol", "activo"], bool: ["activo"], alcance: { tipo: "global", filtro: "usuario" } },
    { nombre: "certificados_tecnico", columnas: ["usuario_id", "organizacion_id", "esquema", "categoria", "numero", "expedido_el", "caduca_el"], alcance: { tipo: "global", filtro: "usuario" } },
    { nombre: "instrumentos", columnas: ["organizacion_id", "nombre", "marca", "modelo", "numero_serie", "calibrado_hasta", "estado"], alcance: { tipo: "global" } },
    { nombre: "contratos", columnas: ["titular_id", "mantenedora_id", "referencia", "inicio", "fin", "estado"], alcance: { tipo: "global" } },
    { nombre: "ordenes_trabajo", columnas: ["empresa_id", "contrato_id", "edificio_id", "titular_id", "tecnico_id", "fecha_prevista", "estado", "descripcion"], alcance: { tipo: "global", filtro: "tecnico" } },
    { nombre: "proyecto_participantes", columnas: ["proyecto_id", "organizacion_id", "papel", "disciplinas", "escritura", "inicio", "fin", "estado"], json: ["disciplinas"], bool: ["escritura"], alcance: { tipo: "global" } },
    { nombre: "plantillas_prueba", columnas: ["organizacion_id", "codigo", "revision", "tipo_prueba", "clase_equipo", "disciplina", "nivel", "titulo_codigo", "titulo", "estado"], alcance: { tipo: "global", filtro: "publicadas" } },
    { nombre: "plantilla_puntos", columnas: ["plantilla_id", "orden", "codigo", "categoria", "texto_codigo", "texto", "criterio", "tipo_respuesta", "obligatorio", "requiere_evidencia"], bool: ["obligatorio", "requiere_evidencia"], alcance: { tipo: "hijo", padre: "plantillas_prueba", fk: "plantilla_id" } },
    { nombre: "textos_sistema", columnas: ["organizacion_id", "codigo", "idioma", "texto"], alcance: { tipo: "global" } },
    // Cilindros de la mantenedora (0016_cilindros.sql). Bajan todos los que el RLS
    // deja ver, no solo los del técnico: si la oficina pasa uno a otra furgoneta,
    // el cambio de tecnico_id también tiene que llegar. La furgoneta filtra los suyos.
    {
      nombre: "cilindros",
      columnas: [
        "organizacion_id",
        "tecnico_id",
        "codigo",
        "uso",
        "refrigerante",
        "origen",
        "kg",
        "capacidad_kg",
        "lote",
        "lugar_tratamiento",
        "reciclado_por_mi_empresa",
        "estado"
      ],
      bool: ["reciclado_por_mi_empresa"],
      alcance: { tipo: "global" }
    },
    { nombre: "edificios", columnas: ["titular_id", "nombre", "direccion", "municipio", "provincia", "ccaa", "uso"], alcance: { tipo: "edificio", columna: "id" } },
    { nombre: "proyectos_cx", columnas: ["titular_id", "edificio_id", "codigo", "nombre", "fase", "idioma_entregables"], alcance: { tipo: "edificio", columna: "edificio_id" } },
    { nombre: "ubicaciones", columnas: ["edificio_id", "padre_id", "nivel", "codigo", "nombre", "orden"], alcance: { tipo: "edificio", columna: "edificio_id" } },
    { nombre: "instalaciones", columnas: ["edificio_id", "nombre", "ccaa", "potencia_calor_kw", "potencia_frio_kw"], alcance: { tipo: "edificio", columna: "edificio_id" } },
    { nombre: "sistemas", columnas: ["edificio_id", "codigo", "nombre", "disciplina"], alcance: { tipo: "edificio", columna: "edificio_id" } },
    {
      nombre: "equipos",
      columnas: [
        "edificio_id",
        "titular_id",
        "instalacion_id",
        "proyecto_id",
        "sistema_id",
        "ubicacion_id",
        "modelo_id",
        "disciplina",
        "tag",
        "descripcion",
        "estado_montaje",
        "estado_pm",
        "estado",
        "fabricante",
        "modelo",
        "numero_serie",
        "tipo",
        "refrigerante",
        "carga_kg",
        "hermetico",
        "deteccion_fugas",
        "en_vivienda",
        "potencia_frio_kw",
        "potencia_calor_kw",
        "fecha_instalacion",
        "qr_token"
      ],
      bool: ["hermetico", "deteccion_fugas", "en_vivienda"],
      alcance: { tipo: "edificio", columna: "edificio_id" }
    },
    {
      nombre: "intervenciones",
      columnas: [
        "equipo_id",
        "edificio_id",
        "contrato_id",
        "empresa_id",
        "tecnico_id",
        "tipo",
        "realizada_en",
        "resultado",
        "observaciones",
        "estado",
        "firmante_cliente_nombre",
        "firmante_cliente_cargo",
        "tecnico_nombre",
        "anula_a_id"
      ],
      alcance: { tipo: "edificio", columna: "edificio_id" }
    },
    { nombre: "movimientos_gas", columnas: ["intervencion_id", "sentido", "refrigerante", "kg", "origen", "lugar_tratamiento", "cilindro", "lote"], alcance: { tipo: "hijo", padre: "intervenciones", fk: "intervencion_id" } },
    {
      nombre: "operaciones_mantenimiento",
      columnas: [
        "edificio_id",
        "instalacion_id",
        "equipo_id",
        "contrato_id",
        "empresa_id",
        "tecnico_id",
        "codigo_operacion",
        "periodicidad",
        "realizada_en",
        "resultado",
        "observaciones",
        "estado"
      ],
      alcance: { tipo: "edificio", columna: "edificio_id", desdeMeses: 13, columnaFecha: "realizada_en" }
    },
    {
      nombre: "ejecuciones_prueba",
      columnas: [
        "proyecto_id",
        "edificio_id",
        "equipo_id",
        "sistema_id",
        "disciplina",
        "tipo_prueba",
        "nivel",
        "plantilla_id",
        "organizacion_id",
        "ejecutada_por",
        "realizada_en",
        "estado",
        "resultado"
      ],
      alcance: { tipo: "edificio", columna: "edificio_id" }
    },
    { nombre: "resultados_punto", columnas: ["ejecucion_id", "punto_id", "punto_codigo", "texto_codigo", "estado", "valor_texto", "hecho_por", "hecho_en"], alcance: { tipo: "hijo", padre: "ejecuciones_prueba", fk: "ejecucion_id" } },
    {
      nombre: "incidencias",
      columnas: [
        "proyecto_id",
        "edificio_id",
        "equipo_id",
        "ubicacion_id",
        "ejecucion_id",
        "disciplina",
        "titulo",
        "motivo_codigo",
        "descripcion",
        "gravedad",
        "estado",
        "responsable_org_id",
        "creado_por",
        "creado_en"
      ],
      alcance: { tipo: "edificio", columna: "edificio_id" }
    },
    {
      nombre: "documentos",
      columnas: ["edificio_id", "titular_id", "modelo_id", "equipo_id", "intervencion_id", "incidencia_id", "tipo", "titulo", "ruta", "mime", "bytes", "sha256", "estado_revision"],
      alcance: { tipo: "edificio", columna: "edificio_id" }
    }
  ];
  var TABLAS_ESPEJO = new Map(ESPEJO.map((t) => [t.nombre, t]));
  function crearEspejo(t) {
    const cols = t.columnas.map((c) => `  ${c}`).join(",\n");
    return `create table if not exists ${t.nombre} (
  id text primary key,
${cols},
  version integer not null default 0,
  actualizado_en text,
  borrado_en text
);`;
  }
  var LOCALES = `
-- Cola de cambios pendientes de subir, en orden de creaci\xF3n.
--   tipo 'fila': insert/update de una fila (cambios + lo que hab\xEDa antes, para rebasar un PT409)
--   tipo 'intervencion': public.subir_intervencion(json), que sube cabecera, movimientos y firma juntos
--   tipo 'fichero': sube a Storage el fichero de un documento cuya fila ya se subi\xF3
create table if not exists cola (
  n integer primary key autoincrement,
  tipo text not null check (tipo in ('fila', 'intervencion', 'fichero')),
  tabla text not null,
  fila_id text not null,
  operacion text not null default 'upsert' check (operacion in ('upsert', 'update', 'rpc', 'subir')),
  cambios text not null default '{}',
  antes text,
  version_leida integer,
  creado_en text not null,
  intentos integer not null default 0,
  ultimo_intento text,
  mensaje text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'rechazado'))
);
create index if not exists cola_fila_idx on cola (tabla, fila_id, estado);

-- Ficheros del m\xF3vil (fotos y firmas) que a\xFAn no est\xE1n en Storage.
create table if not exists ficheros (
  documento_id text primary key,
  uri text,
  contenido text,
  mime text not null,
  subido integer not null default 0
);

-- Lo que queda de un conflicto al juntar cambios de dos personas (R4): la pantalla lo ense\xF1a.
create table if not exists conflictos (
  id text primary key,
  tabla text not null,
  fila_id text not null,
  campo text not null,
  mio text,
  servidor text,
  creado_en text not null,
  visto integer not null default 0
);

-- La visita del d\xEDa a un edificio (mantenimiento).
create table if not exists visitas (
  id text primary key,
  edificio_id text not null,
  orden_id text,
  contrato_id text,
  fecha text not null,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  cliente_nombre text,
  cliente_cargo text,
  cliente_enlace integer not null default 0,
  cerrada_en text
);
create table if not exists visita_equipos (
  visita_id text not null,
  equipo_id text not null,
  terminado integer not null default 0,
  primary key (visita_id, equipo_id)
);

-- Avisos que el t\xE9cnico deja a la oficina sin cobertura (\xABno cargar y avisar\xBB).
create table if not exists avisos_oficina (
  id text primary key,
  edificio_id text,
  equipo_id text,
  texto text not null,
  creado_en text not null
);

-- Borrador que naci\xF3 de otro y se va con \xE9l: la fuga anotada en \xABUna pregunta\xBB
-- tras a\xF1adir gas depende de esa carga (si se quita la carga, se quita la fuga).
create table if not exists enlaces_borrador (
  intervencion_id text primary key,
  depende_de text not null
);

create table if not exists ajustes (
  clave text primary key,
  valor text
);
`;
  function sqlEsquema() {
    return ESPEJO.map(crearEspejo).join("\n") + "\n" + LOCALES;
  }
  async function ampliarEspejo(base2) {
    const anadidas = [];
    for (const t of ESPEJO) {
      const hay = new Set((await base2.todas(`pragma table_info(${t.nombre})`)).map((c) => c.name));
      const deBajada = [["version", "version integer not null default 0"], ["actualizado_en", "actualizado_en text"], ["borrado_en", "borrado_en text"]];
      const faltan = [...t.columnas.filter((c) => !hay.has(c)).map((c) => [c, c]), ...deBajada.filter(([c]) => !hay.has(c))];
      for (const [c, def] of faltan) {
        await base2.ejecutar(`alter table ${t.nombre} add column ${def}`);
        anadidas.push(`${t.nombre}.${c}`);
      }
      if (faltan.length) await base2.ejecutar(`delete from ajustes where clave = ? or clave like ?`, [`cursor:${t.nombre}`, `cursor:${t.nombre}:%`]);
    }
    return anadidas;
  }
  function aLocal(t, fila2) {
    const valores = [String(fila2.id)];
    for (const c of t.columnas) valores.push(valorLocal(t, c, fila2[c]));
    valores.push(Number(fila2.version ?? 0), fila2.actualizado_en ?? null, fila2.borrado_en ?? null);
    return valores;
  }
  function valorLocal(t, columna, v) {
    if (v === void 0 || v === null) return null;
    if (t.json?.includes(columna)) return JSON.stringify(v);
    if (t.bool?.includes(columna) || typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  }
  function aServidor(t, fila2) {
    const r = { id: fila2.id };
    for (const c of t.columnas) {
      if (!(c in fila2)) continue;
      r[c] = valorServidor(t, c, fila2[c]);
    }
    return r;
  }
  function valorServidor(t, columna, v) {
    if (v === null || v === void 0) return null;
    if (t.json?.includes(columna)) return typeof v === "string" ? JSON.parse(v) : v;
    if (t.bool?.includes(columna)) return v === 1 || v === true || v === "1";
    return v;
  }
  function sqlUpsertEspejo(t) {
    const cols = ["id", ...t.columnas, "version", "actualizado_en", "borrado_en"];
    const marcas = cols.map(() => "?").join(", ");
    const set = cols.slice(1).map((c) => `${c} = excluded.${c}`).join(", ");
    return `insert into ${t.nombre} (${cols.join(", ")}) values (${marcas}) on conflict (id) do update set ${set}`;
  }

  // cxobra/mantenimiento/fuente/datos/base-wasm.ts
  var NOMBRE = "vidaire-mant";
  var CLAVE = "mant.db";
  function abrirIdb() {
    return new Promise((ok, mal) => {
      const pet = indexedDB.open(NOMBRE, 1);
      pet.onupgradeneeded = () => {
        pet.result.createObjectStore("base");
      };
      pet.onsuccess = () => ok(pet.result);
      pet.onerror = () => mal(pet.error);
    });
  }
  async function leer() {
    const d = await abrirIdb();
    return new Promise((ok, mal) => {
      const r = d.transaction("base", "readonly").objectStore("base").get(CLAVE);
      r.onsuccess = () => ok(r.result ? new Uint8Array(r.result) : null);
      r.onerror = () => mal(r.error);
    });
  }
  async function escribir(bytes) {
    const d = await abrirIdb();
    return new Promise((ok, mal) => {
      const tx = d.transaction("base", "readwrite");
      tx.objectStore("base").put(bytes, CLAVE);
      tx.oncomplete = () => ok();
      tx.onerror = () => mal(tx.error);
    });
  }
  async function abrirBaseWasm(urlWasm) {
    const SQL = await (0, import_sql.default)({ locateFile: () => urlWasm });
    const previa = await leer().catch(() => null);
    let db = new SQL.Database(previa ?? void 0);
    let temporizador = null;
    let profundidad = 0;
    const guardarYa = async () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = null;
      await escribir(db.export());
    };
    const pedirGuardado = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        guardarYa().catch((e) => console.error("No se pudo guardar:", e));
      }, 1e3);
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && temporizador) guardarYa().catch(() => {
        });
      });
    }
    const consultar = (sql, params) => {
      const st = db.prepare(sql);
      try {
        if (params && params.length) st.bind([...params]);
        const filas = [];
        while (st.step()) filas.push(st.getAsObject());
        return filas;
      } finally {
        st.free();
      }
    };
    const base2 = {
      recuperada: previa !== null,
      async ejecutar(sql, params) {
        db.run(sql, params ? [...params] : void 0);
        pedirGuardado();
      },
      async todas(sql, params) {
        return consultar(sql, params);
      },
      async una(sql, params) {
        return consultar(sql, params)[0] ?? null;
      },
      async script(sql) {
        db.exec(sql);
        pedirGuardado();
      },
      async transaccion(fn) {
        if (profundidad > 0) return fn();
        profundidad++;
        db.exec("begin");
        try {
          await fn();
          db.exec("commit");
        } catch (e) {
          db.exec("rollback");
          throw e;
        } finally {
          profundidad--;
        }
        pedirGuardado();
      },
      guardarYa,
      async vaciar() {
        db.close();
        db = new SQL.Database();
        await base2.script(sqlEsquema());
        await guardarYa();
      }
    };
    await base2.script(sqlEsquema());
    if (previa) await ampliarEspejo(base2);
    return base2;
  }

  // cxobra/mantenimiento/fuente/datos/demo.ts
  var DEMO_USUARIO = { id: "demo-usuario", nombre: "Luis Pardo G\xF3mez", organizacionId: "org-mant", instaladoraId: "org-inst" };
  async function fila(base2, tabla2, f) {
    const t = TABLAS_ESPEJO.get(tabla2);
    const cols = ["id", ...t.columnas.filter((c) => c in f)];
    await base2.ejecutar(`insert or replace into ${tabla2} (${cols.join(", ")}, version, actualizado_en) values (${cols.map(() => "?").join(", ")}, 1, '2026-09-01T00:00:00Z')`, cols.map((c) => f[c] ?? null));
  }
  function menosMeses(hoy, meses, dia) {
    const [a, m, d] = hoy.split("-").map(Number);
    const total = a * 12 + (m - 1) - meses;
    return `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, "0")}-${String(dia ?? Math.min(d, 28)).padStart(2, "0")}`;
  }
  async function cargarDemo(base2, hoy) {
    const u = DEMO_USUARIO;
    await base2.transaccion(async () => {
      await fila(base2, "organizaciones", { id: "org-mant", nombre: "Fr\xEDo Centro Mantenimiento S.L.", tipos: '["mantenedora"]', cert_empresa_fgas: "EH-FG-0412" });
      await fila(base2, "organizaciones", { id: "org-inst", nombre: "Instalaciones Centro Obra S.L.", tipos: '["instaladora"]' });
      await fila(base2, "organizaciones", { id: "org-tit", nombre: "Inmuebles Ribera Uno", tipos: '["titular"]' });
      await fila(base2, "perfiles", { id: u.id, nombre_completo: u.nombre, idioma: "es" });
      await fila(base2, "miembros", { id: "mb-1", organizacion_id: "org-mant", usuario_id: u.id, rol: "tecnico", activo: 1 });
      await fila(base2, "miembros", { id: "mb-2", organizacion_id: "org-inst", usuario_id: u.id, rol: "tecnico", activo: 1 });
      await fila(base2, "certificados_tecnico", { id: "ct-1", usuario_id: u.id, organizacion_id: "org-mant", esquema: "fgas", categoria: "I.1 \xB7 cualquier carga", numero: "CM-FG-08812", expedido_el: "2019-05-10", caduca_el: "2029-03-12" });
      await fila(base2, "certificados_tecnico", { id: "ct-2", usuario_id: u.id, organizacion_id: "org-mant", esquema: "rite", categoria: "Mantenedor RITE", numero: "M-RT-4471", expedido_el: "2018-02-01", caduca_el: null });
      await fila(base2, "contratos", { id: "ctr-1", titular_id: "org-tit", mantenedora_id: "org-mant", referencia: "MANT-2026-01", inicio: "2025-01-01", fin: null, estado: "vigente" });
      await fila(base2, "edificios", { id: "ed-ma44", titular_id: "org-tit", nombre: "Oficinas M\xE9ndez \xC1lvaro 44", municipio: "Madrid", ccaa: "ES-MD", uso: "oficinas" });
      await fila(base2, "edificios", { id: "ed-alc", titular_id: "org-tit", nombre: "P. E. Alcobendas \xB7 Edificio B", municipio: "Alcobendas (Madrid)", ccaa: "ES-MD", uso: "oficinas" });
      await fila(base2, "ordenes_trabajo", { id: "ot-1", empresa_id: "org-mant", contrato_id: "ctr-1", edificio_id: "ed-ma44", titular_id: "org-tit", tecnico_id: u.id, fecha_prevista: hoy, estado: "pendiente", descripcion: "8:00 \xB7 Marta Ruiz, mantenimiento del edificio" });
      await fila(base2, "ordenes_trabajo", { id: "ot-2", empresa_id: "org-mant", contrato_id: "ctr-1", edificio_id: "ed-alc", titular_id: "org-tit", tecnico_id: u.id, fecha_prevista: hoy, estado: "pendiente", descripcion: "11:30 \xB7 Jorge Salas, jefe de mantenimiento" });
      await fila(base2, "instalaciones", { id: "in-ma44", edificio_id: "ed-ma44", nombre: "Climatizaci\xF3n", ccaa: "ES-MD", potencia_frio_kw: 420, potencia_calor_kw: 0 });
      await fila(base2, "instalaciones", { id: "in-alc", edificio_id: "ed-alc", nombre: "Climatizaci\xF3n", ccaa: "ES-MD", potencia_frio_kw: 372, potencia_calor_kw: 0 });
      const ubic = [
        ["u-ma-cub", "ed-ma44", "Cubierta", 1],
        ["u-ma-pb", "ed-ma44", "Planta baja", 2],
        ["u-ma-s1", "ed-ma44", "S\xF3tano -1", 3],
        ["u-alc-cub", "ed-alc", "Cubierta", 1],
        ["u-alc-s2", "ed-alc", "S\xF3tano -2", 2]
      ];
      for (const [id, ed, nombre, orden] of ubic) await fila(base2, "ubicaciones", { id, edificio_id: ed, nivel: "planta", codigo: nombre.toUpperCase().replace(/\s/g, ""), nombre, orden });
      const eq = (o) => fila(base2, "equipos", { titular_id: "org-tit", disciplina: "clima", estado: "activo", estado_montaje: "recepcionado", estado_pm: "hecha", hermetico: 0, deteccion_fugas: 0, en_vivienda: 0, ...o });
      await eq({ id: "eq-en01", edificio_id: "ed-ma44", instalacion_id: "in-ma44", ubicacion_id: "u-ma-cub", tag: "EN-01", descripcion: "Enfriadora aire-agua", tipo: "enfriadora", refrigerante: "R410A", carga_kg: 42, potencia_frio_kw: 262, fabricante: "Friotec", modelo: "EAA-260 2C", numero_serie: "FT19-44821", fecha_instalacion: "2019-06-01", qr_token: "QR-EN01-MA44XX" });
      await eq({ id: "eq-vrf01", edificio_id: "ed-ma44", instalacion_id: "in-ma44", ubicacion_id: "u-ma-cub", tag: "VRF-01", descripcion: "VRF plantas 1 a 3", tipo: "vrf", refrigerante: "R410A", carga_kg: 18.5, potencia_frio_kw: 56, fabricante: "Nordair", modelo: "VX-560", numero_serie: "NA17-2231", qr_token: "QR-VRF01-MA44X" });
      await eq({ id: "eq-spl02", edificio_id: "ed-ma44", instalacion_id: "in-ma44", ubicacion_id: "u-ma-pb", tag: "SPL-02", descripcion: "Split recepci\xF3n", tipo: "split", refrigerante: "R32", carga_kg: 1.05, potencia_frio_kw: 3.5, fabricante: "Airmon", modelo: "S-35", numero_serie: "AM22-1180", qr_token: "QR-SPL02-MA44X" });
      await eq({ id: "eq-cf01", edificio_id: "ed-ma44", instalacion_id: "in-ma44", ubicacion_id: "u-ma-s1", tag: "CF-01", descripcion: "C\xE1mara frigor\xEDfica cafeter\xEDa", tipo: "camara_frigorifica", refrigerante: "R404A", carga_kg: 6.5, potencia_frio_kw: 4.2, fabricante: "Polarfrig", modelo: "CF-42", numero_serie: "PF12-0551", qr_token: "QR-CF01-MA44XX" });
      await eq({ id: "eq-spl01", edificio_id: "ed-ma44", instalacion_id: "in-ma44", ubicacion_id: "u-ma-s1", tag: "SPL-01", descripcion: "Split sala de rack", tipo: "split", refrigerante: "R32", carga_kg: 2.1, potencia_frio_kw: 7.1, fabricante: "Airmon", modelo: "S-71", numero_serie: "AM23-0042", qr_token: "QR-SPL01-MA44X" });
      await eq({ id: "eq-rt01", edificio_id: "ed-alc", instalacion_id: "in-alc", ubicacion_id: "u-alc-cub", tag: "RT-01", descripcion: "Rooftop zona comercial", tipo: "rooftop", refrigerante: "R410A", carga_kg: 16, potencia_frio_kw: 62, fabricante: "Friotec", modelo: "RTC-62", qr_token: "QR-RT01-ALCXXX" });
      await eq({ id: "eq-en02", edificio_id: "ed-alc", instalacion_id: "in-alc", ubicacion_id: "u-alc-s2", tag: "EN-02", descripcion: "Enfriadora agua-agua", tipo: "enfriadora", refrigerante: "R134a", carga_kg: 60, deteccion_fugas: 1, potencia_frio_kw: 310, fabricante: "Friotec", modelo: "EWW-310", qr_token: "QR-EN02-ALCXXX" });
      const control = (id, equipo2, ed, fecha) => fila(base2, "intervenciones", {
        id,
        equipo_id: equipo2,
        edificio_id: ed,
        contrato_id: "ctr-1",
        empresa_id: "org-mant",
        tecnico_id: u.id,
        tipo: "control_fugas",
        realizada_en: `${fecha}T09:00:00Z`,
        resultado: "sin_fugas",
        estado: "firmado",
        tecnico_nombre: "L. Pardo"
      });
      await control("i-1", "eq-en01", "ed-ma44", menosMeses(hoy, 6));
      await control("i-2", "eq-vrf01", "ed-ma44", menosMeses(hoy, 13, 15));
      await control("i-3", "eq-cf01", "ed-ma44", menosMeses(hoy, 12, 2));
      await control("i-4", "eq-rt01", "ed-alc", menosMeses(hoy, 11, 20));
      await control("i-5", "eq-en02", "ed-alc", menosMeses(hoy, 5, 2));
      await fila(base2, "intervenciones", { id: "i-6", equipo_id: "eq-cf01", edificio_id: "ed-ma44", contrato_id: "ctr-1", empresa_id: "org-mant", tecnico_id: u.id, tipo: "carga", realizada_en: `${menosMeses(hoy, 3, 11)}T10:00:00Z`, resultado: null, observaciones: "Fuga en v\xE1lvula de servicio, reparada", estado: "firmado", tecnico_nombre: "L. Pardo" });
      await fila(base2, "movimientos_gas", { id: "m-6", intervencion_id: "i-6", sentido: "carga", refrigerante: "R404A", kg: 0.8, origen: "regenerado", lugar_tratamiento: "Planta de regeneraci\xF3n autorizada (Getafe)", cilindro: "C-3310", lote: "RG-26-0193" });
      const cil = (id, codigo, uso, gas, origen, kg2, cap, lote, trat) => fila(base2, "cilindros", { id, organizacion_id: "org-mant", tecnico_id: u.id, codigo, uso, refrigerante: gas, origen, kg: kg2, capacidad_kg: cap, lote, lugar_tratamiento: trat, estado: "en_uso" });
      await cil("c-2231", "C-2231", "carga", "R410A", "virgen", 7.8, null, "L24-0877", null);
      await cil("c-2877", "C-2877", "carga", "R32", "virgen", 4.4, null, "L25-1120", null);
      await cil("c-1904", "C-1904", "carga", "R404A", "virgen", 9.1, null, "L23-0412", null);
      await cil("c-3310", "C-3310", "carga", "R404A", "regenerado", 5.2, null, "RG-26-0193", "Planta de regeneraci\xF3n autorizada (Getafe)");
      await cil("r-12", "R-12", "recuperacion", "R404A", null, 3.1, 10, null, null);
      await cil("r-07", "R-07", "recuperacion", "R410A", null, 0, 20, null, null);
      await fila(base2, "edificios", { id: "ed-ta", titular_id: "org-tit", nombre: "Torre Arganzuela \xB7 obra nueva", municipio: "Madrid", ccaa: "ES-MD", uso: "oficinas" });
      await fila(base2, "proyectos_cx", { id: "px-ta", titular_id: "org-tit", edificio_id: "ed-ta", codigo: "TA-2026", nombre: "Torre Arganzuela", fase: "construccion", idioma_entregables: "es" });
      await fila(base2, "proyecto_participantes", { id: "pp-1", proyecto_id: "px-ta", organizacion_id: "org-inst", papel: "instaladora", disciplinas: '["clima"]', escritura: 1, inicio: "2026-01-01", estado: "vigente" });
      await fila(base2, "ubicaciones", { id: "u-ta-p2", edificio_id: "ed-ta", nivel: "planta", codigo: "P02", nombre: "Planta 2", orden: 2 });
      await fila(base2, "ubicaciones", { id: "u-ta-p3", edificio_id: "ed-ta", nivel: "planta", codigo: "P03", nombre: "Planta 3", orden: 3 });
      await fila(base2, "ubicaciones", { id: "u-ta-p3-rk", edificio_id: "ed-ta", padre_id: "u-ta-p3", nivel: "sala", codigo: "P03-RK", nombre: "Sala de rack", orden: 4 });
      await fila(base2, "sistemas", { id: "s-clima", edificio_id: "ed-ta", codigo: "CLI-OF", nombre: "Climatizaci\xF3n oficinas", disciplina: "clima" });
      const ob = (o) => eq({ edificio_id: "ed-ta", proyecto_id: "px-ta", sistema_id: "s-clima", estado_montaje: "instalado", estado_pm: "pendiente", ...o });
      await ob({ id: "eq-fc301", ubicacion_id: "u-ta-p3", tag: "FC-P3-01", descripcion: "Fan coil zona norte", tipo: "fancoil", fabricante: "Aerotec", modelo: "FCX-40", qr_token: "QR-FCP301-TAXX" });
      await ob({ id: "eq-fc302", ubicacion_id: "u-ta-p3", tag: "FC-P3-02", descripcion: "Fan coil zona centro", tipo: "fancoil", fabricante: "Aerotec", modelo: "FCX-40", qr_token: "QR-FCP302-TAXX" });
      await ob({ id: "eq-fc303", ubicacion_id: "u-ta-p3", tag: "FC-P3-03", descripcion: "Fan coil zona sur", tipo: "fancoil", fabricante: "Aerotec", modelo: "FCX-40", qr_token: "QR-FCP303-TAXX" });
      await ob({ id: "eq-splrk3", ubicacion_id: "u-ta-p3-rk", tag: "SPL-P3-RK", descripcion: "Split sala de rack", tipo: "split", refrigerante: "R32", carga_kg: 1.4, potencia_frio_kw: 5, fabricante: "Airmon", modelo: "S-50", qr_token: "QR-SPLP3RK-TAX" });
      await ob({ id: "eq-fc201", ubicacion_id: "u-ta-p2", tag: "FC-P2-01", descripcion: "Fan coil zona norte", tipo: "fancoil", fabricante: "Aerotec", modelo: "FCX-40", qr_token: "QR-FCP201-TAXX" });
      await fila(base2, "ejecuciones_prueba", { id: "ej-fc201", proyecto_id: "px-ta", edificio_id: "ed-ta", equipo_id: "eq-fc201", disciplina: "clima", tipo_prueba: "checklist", nivel: "L2", organizacion_id: "org-inst", ejecutada_por: u.id, realizada_en: "2026-09-20T09:00:00+02:00", estado: "firmado" });
      for (const [i, c] of ["soportes", "valvulas_corte", "aislamiento", "sifon_cargado", "filtro_sin_bypass", "electrica"].entries()) {
        await fila(base2, "resultados_punto", { id: `rp2-${i}`, ejecucion_id: "ej-fc201", punto_codigo: `fancoil.${c}`, texto_codigo: `punto.fancoil.${c}`, estado: "ok", hecho_por: u.id });
      }
      await fila(base2, "ejecuciones_prueba", { id: "ej-fc302", proyecto_id: "px-ta", edificio_id: "ed-ta", equipo_id: "eq-fc302", disciplina: "clima", tipo_prueba: "checklist", nivel: "L2", organizacion_id: "org-inst", ejecutada_por: u.id, realizada_en: `${menosMeses(hoy, 0)}T08:00:00Z`, estado: "borrador" });
      for (const [i, c, e] of [[1, "soportes", "ok"], [2, "valvulas_corte", "ok"], [3, "aislamiento", "fallo"]]) {
        await fila(base2, "resultados_punto", { id: `rp-${i}`, ejecucion_id: "ej-fc302", punto_codigo: `fancoil.${c}`, texto_codigo: `punto.fancoil.${c}`, estado: e, hecho_por: u.id });
      }
      await fila(base2, "incidencias", { id: "inc-6", proyecto_id: "px-ta", edificio_id: "ed-ta", equipo_id: "eq-fc302", ejecucion_id: "ej-fc302", disciplina: "clima", titulo: "V\xE1lvula de tres v\xEDas sin aislar", gravedad: "menor", estado: "asignada", responsable_org_id: "org-inst", creado_por: u.id, creado_en: "2026-09-22T10:42:00Z" });
      await fila(base2, "incidencias", { id: "inc-4", proyecto_id: "px-ta", edificio_id: "ed-ta", equipo_id: "eq-fc201", disciplina: "clima", titulo: "Man\xF3metro de la prueba de estanqueidad sin calibraci\xF3n vigente", gravedad: "importante", estado: "asignada", responsable_org_id: "org-inst", creado_por: "autoridad-cx", creado_en: "2026-09-15T12:00:00Z" });
    });
  }

  // cxobra/mantenimiento/fuente/datos/almacen.ts
  var almacen_exports = {};
  __export(almacen_exports, {
    actualizar: () => actualizar,
    ahoraISO: () => ahoraISO,
    ahoraLocalISO: () => ahoraLocalISO,
    cambiarBorrador: () => cambiarBorrador,
    deshacerCambio: () => deshacerCambio,
    deshacerInsercion: () => deshacerInsercion,
    encolarIntervencion: () => encolarIntervencion,
    encolarSubida: () => encolarSubida,
    guardarAjuste: () => guardarAjuste,
    guardarFichero: () => guardarFichero,
    insertar: () => insertar,
    insertarBorrador: () => insertarBorrador,
    leerAjuste: () => leerAjuste,
    pendientes: () => pendientes
  });
  function ahoraISO() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function ahoraLocalISO(d = /* @__PURE__ */ new Date()) {
    const off = -d.getTimezoneOffset();
    const dos = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}${off >= 0 ? "+" : "-"}${dos(off / 60)}:${dos(off % 60)}`;
  }
  function tabla(nombre) {
    const t = TABLAS_ESPEJO.get(nombre);
    if (!t) throw new Error(`Tabla desconocida: ${nombre}`);
    return t;
  }
  async function insertar(base2, nombre, fila2) {
    const t = tabla(nombre);
    const cols = ["id", ...t.columnas.filter((c) => c in fila2)];
    await base2.transaccion(async () => {
      await base2.ejecutar(
        `insert into ${nombre} (${cols.join(", ")}, version) values (${cols.map(() => "?").join(", ")}, 0)`,
        cols.map((c) => fila2[c] ?? null)
      );
      await encolarFila(base2, nombre, String(fila2.id), "upsert", pick(fila2, cols), null, null, true);
    });
  }
  async function actualizar(base2, nombre, id, cambios, opciones = {}) {
    const t = tabla(nombre);
    const campos = Object.keys(cambios).filter((c) => t.columnas.includes(c));
    if (!campos.length) return;
    await base2.transaccion(async () => {
      const actual = await base2.una(`select * from ${nombre} where id = ?`, [id]);
      if (!actual) throw new Error(`No existe ${nombre} ${id}`);
      await base2.ejecutar(`update ${nombre} set ${campos.map((c) => `${c} = ?`).join(", ")} where id = ?`, [...campos.map((c) => cambios[c] ?? null), id]);
      const version = Number(actual.version ?? 0);
      await encolarFila(base2, nombre, id, version > 0 ? "update" : "upsert", pick(cambios, campos), pick(actual, campos), version > 0 ? version : null, opciones.juntar ?? true);
    });
  }
  async function insertarBorrador(base2, nombre, fila2) {
    const t = tabla(nombre);
    const cols = ["id", ...t.columnas.filter((c) => c in fila2)];
    await base2.ejecutar(
      `insert into ${nombre} (${cols.join(", ")}, version) values (${cols.map(() => "?").join(", ")}, 0)`,
      cols.map((c) => fila2[c] ?? null)
    );
  }
  async function cambiarBorrador(base2, nombre, id, cambios) {
    const t = tabla(nombre);
    const campos = Object.keys(cambios).filter((c) => t.columnas.includes(c));
    if (!campos.length) return;
    await base2.ejecutar(`update ${nombre} set ${campos.map((c) => `${c} = ?`).join(", ")} where id = ? and version = 0`, [...campos.map((c) => cambios[c] ?? null), id]);
  }
  async function encolarSubida(base2, nombre, id) {
    const t = tabla(nombre);
    const fila2 = await base2.una(`select * from ${nombre} where id = ?`, [id]);
    if (!fila2) throw new Error(`No existe ${nombre} ${id}`);
    await encolarFila(base2, nombre, id, "upsert", pick(fila2, ["id", ...t.columnas]), null, null, true);
  }
  async function encolarFila(base2, nombre, id, operacion, cambios, antes, version, juntar) {
    const previa = !juntar ? null : await base2.una(
      `select n, operacion, cambios, antes from cola where tipo = 'fila' and tabla = ? and fila_id = ? and estado = 'pendiente' and intentos = 0 order by n desc limit 1`,
      [nombre, id]
    );
    if (previa) {
      const juntos = { ...JSON.parse(previa.cambios), ...cambios };
      const antesJuntos = previa.antes || antes ? { ...antes ?? {}, ...JSON.parse(previa.antes ?? "{}") } : null;
      await base2.ejecutar("update cola set cambios = ?, antes = ? where n = ?", [JSON.stringify(juntos), antesJuntos ? JSON.stringify(antesJuntos) : null, previa.n]);
      return;
    }
    await base2.ejecutar(
      `insert into cola (tipo, tabla, fila_id, operacion, cambios, antes, version_leida, creado_en) values ('fila', ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, id, operacion, JSON.stringify(cambios), antes ? JSON.stringify(antes) : null, version, ahoraISO()]
    );
  }
  async function encolarIntervencion(base2, id) {
    const ya = await base2.una(`select n from cola where tipo = 'intervencion' and fila_id = ? and estado = 'pendiente'`, [id]);
    if (ya) return;
    await base2.ejecutar(`insert into cola (tipo, tabla, fila_id, operacion, creado_en) values ('intervencion', 'intervenciones', ?, 'rpc', ?)`, [id, ahoraISO()]);
  }
  async function guardarFichero(base2, documentoId, f) {
    await base2.ejecutar("insert or replace into ficheros (documento_id, uri, contenido, mime, subido) values (?, ?, ?, ?, 0)", [documentoId, f.uri ?? null, f.contenido ?? null, f.mime]);
    await base2.ejecutar(`insert into cola (tipo, tabla, fila_id, operacion, creado_en) values ('fichero', 'documentos', ?, 'subir', ?)`, [documentoId, ahoraISO()]);
  }
  async function deshacerInsercion(base2, nombre, id) {
    tabla(nombre);
    const f = await base2.una(`select version from ${nombre} where id = ?`, [id]);
    if (!f || f.version > 0) return false;
    const enviada = await base2.una(`select n from cola where tabla = ? and fila_id = ? and intentos > 0`, [nombre, id]);
    if (enviada) return false;
    await base2.transaccion(async () => {
      await base2.ejecutar(`delete from cola where tabla = ? and fila_id = ?`, [nombre, id]);
      await base2.ejecutar(`delete from ${nombre} where id = ?`, [id]);
    });
    return true;
  }
  async function deshacerCambio(base2, nombre, id, antes) {
    await actualizar(base2, nombre, id, antes);
  }
  async function pendientes(base2) {
    const r = await base2.una(
      `select sum(case when estado = 'pendiente' then 1 else 0 end) as p, sum(case when estado = 'rechazado' then 1 else 0 end) as r from cola`
    );
    return { porEnviar: Number(r?.p ?? 0), rechazados: Number(r?.r ?? 0) };
  }
  async function leerAjuste(base2, clave) {
    const r = await base2.una("select valor from ajustes where clave = ?", [clave]);
    return r?.valor ?? null;
  }
  async function guardarAjuste(base2, clave, valor) {
    await base2.ejecutar("insert into ajustes (clave, valor) values (?, ?) on conflict (clave) do update set valor = excluded.valor", [clave, valor]);
  }
  function pick(o, campos) {
    const r = {};
    for (const c of campos) r[c] = o[c] ?? null;
    return r;
  }

  // cxobra/mantenimiento/fuente/datos/uuid.ts
  var aleatorio = (n) => {
    const b = new Uint8Array(n);
    const c = globalThis.crypto;
    if (!c?.getRandomValues) throw new Error("No hay generador de n\xFAmeros aleatorios: llama a fijarAleatorio() al arrancar.");
    c.getRandomValues(b);
    return b;
  };
  var ultimoMs = 0;
  var secuencia = 0;
  function uuidv7(ahoraMs = Date.now()) {
    const b = aleatorio(16);
    if (ahoraMs <= ultimoMs) {
      ahoraMs = ultimoMs;
      secuencia = secuencia + 1 & 4095;
    } else {
      ultimoMs = ahoraMs;
      secuencia = (b[6] & 15) << 8 | b[7];
      secuencia &= 2047;
    }
    let ms = ahoraMs;
    for (let i = 5; i >= 0; i--) {
      b[i] = ms % 256;
      ms = Math.floor(ms / 256);
    }
    b[6] = 112 | secuencia >> 8 & 15;
    b[7] = secuencia & 255;
    b[8] = b[8] & 63 | 128;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // cxobra/mantenimiento/fuente/logica/mantenimiento.ts
  var mantenimiento_exports = {};
  __export(mantenimiento_exports, {
    Bloqueo: () => Bloqueo,
    altaCilindro: () => altaCilindro,
    altaEquipo: () => altaEquipo,
    avisarOficina: () => avisarOficina,
    borrarBorrador: () => borrarBorrador,
    buscarPorQr: () => buscarPorQr,
    cargarGas: () => cargarGas,
    cerrarVisita: () => cerrarVisita,
    cilindroPorCodigo: () => cilindroPorCodigo,
    cilindros: () => cilindros,
    contextoDeVisita: () => contextoDeVisita,
    deshacerAlta: () => deshacerAlta,
    deshacerIt3: () => deshacerIt3,
    desmontadoEl: () => desmontadoEl,
    equipo: () => equipo,
    equiposDelEdificio: () => equiposDelEdificio,
    estadoDeEquipo: () => estadoDeEquipo,
    estadoDeEquipos: () => estadoDeEquipos,
    guardarIt3: () => guardarIt3,
    hayFuga: () => hayFuga,
    hechoHoy: () => hechoHoy,
    historial: () => historial,
    it3DeHoy: () => it3DeHoy,
    misCertificados: () => misCertificados,
    puedo: () => puedo,
    recuperarGas: () => recuperarGas,
    respuestaFuga: () => respuestaFuga,
    resumenVisita: () => resumenVisita,
    rutaDeHoy: () => rutaDeHoy,
    siguientePendiente: () => siguientePendiente,
    sinFuga: () => sinFuga,
    tagDeEtiqueta: () => tagDeEtiqueta,
    terminarEquipo: () => terminarEquipo,
    tieneAlgo: () => tieneAlgo,
    ubicacionesDelEdificio: () => ubicacionesDelEdificio,
    ultimoControl: () => ultimoControl,
    visita: () => visita,
    visitaPorId: () => visitaPorId,
    visitasSinCerrar: () => visitasSinCerrar
  });

  // cxobra/mantenimiento/fuente/logica/reglas.ts
  var reglas_exports = {};
  __export(reglas_exports, {
    alternativaLegal: () => alternativaLegal,
    cilindroDeRecuperacion: () => cilindroDeRecuperacion,
    cilindrosParaCargar: () => cilindrosParaCargar,
    citas: () => citas,
    comprobarCilindro: () => comprobarCilindro,
    fichaGas: () => fichaGas,
    gasDe: () => gasDe,
    habilitacion: () => habilitacion,
    operacionesIt3: () => operacionesIt3,
    porcentajeDeCarga: () => porcentajeDeCarga,
    trasReparar: () => trasReparar,
    usoArt13: () => usoArt13
  });

  // cxobra/mantenimiento/normativa/src/index.ts
  var src_exports = {};
  __export(src_exports, {
    CAMPOS_REGISTRO_ART7: () => CAMPOS_REGISTRO_ART7,
    CONTENIDO_CERTIFICADO_MANTENIMIENTO: () => CONTENIDO_CERTIFICADO_MANTENIMIENTO,
    ENTRADA_EN_VIGOR_FGAS: () => ENTRADA_EN_VIGOR_FGAS,
    FUENTE_TABLAS_IT3: () => FUENTE_TABLAS_IT3,
    IDS_REFRIGERANTES: () => IDS_REFRIGERANTES,
    LEYENDA_TABLA_3_3: () => LEYENDA_TABLA_3_3,
    LIMITE_PRIMERA_ACTUALIZACION: () => LIMITE_PRIMERA_ACTUALIZACION,
    MEDIDAS_GENERADORES_CALOR: () => MEDIDAS_GENERADORES_CALOR,
    MEDIDAS_GENERADORES_FRIO: () => MEDIDAS_GENERADORES_FRIO,
    REFRIGERANTES: () => REFRIGERANTES,
    SUSTANCIAS: () => SUSTANCIAS,
    TABLA_3_1: () => TABLA_3_1,
    TABLA_3_2: () => TABLA_3_2,
    TABLA_3_3: () => TABLA_3_3,
    URL: () => URL2,
    buscarRefrigerante: () => buscarRefrigerante,
    cargaParaTco2e: () => cargaParaTco2e,
    certificadoEnRegla: () => certificadoEnRegla,
    citar: () => citar,
    comparar: () => comparar,
    comprobacionTrasReparacion: () => comprobacionTrasReparacion,
    conservarRegistroHasta: () => conservarRegistroHasta,
    conservarRegistroMantenimientoHasta: () => conservarRegistroMantenimientoHasta,
    controlFugas: () => controlFugas,
    desde: () => desde,
    deteccionFugas: () => deteccionFugas,
    diasEntre: () => diasEntre,
    esAnterior: () => esAnterior,
    esFechaValida: () => esFechaValida,
    esGasFluorado: () => esGasFluorado,
    estadoCertificado: () => estadoCertificado,
    exposicionPhaseDown: () => exposicionPhaseDown,
    fechaLarga: () => fechaLarga,
    formatearPca: () => formatearPca,
    formatearTco2e: () => formatearTco2e,
    inspeccionesEficiencia: () => inspeccionesEficiencia,
    medidasGeneradorCalor: () => medidasGeneradorCalor,
    medidasGeneradorFrio: () => medidasGeneradorFrio,
    numeroES: () => numeroES,
    operacionesTabla33: () => operacionesTabla33,
    partes: () => partes,
    pcaMezcla: () => pcaMezcla,
    periodicidadMantenimiento: () => periodicidadMantenimiento,
    proximoControlFugas: () => proximoControlFugas,
    proximoMantenimiento: () => proximoMantenimiento,
    puedeRealizar: () => puedeRealizar,
    puedeRecargar: () => puedeRecargar,
    refFgas: () => refFgas,
    refRd115: () => refRd115,
    refRite: () => refRite,
    refSao: () => refSao,
    refrigerante: () => refrigerante,
    regimenMantenimiento: () => regimenMantenimiento,
    sumarAnios: () => sumarAnios,
    sumarDias: () => sumarDias,
    sumarMeses: () => sumarMeses,
    tco2e: () => tco2e,
    validarIntervencion: () => validarIntervencion,
    vencimientoCertificadoMantenimiento: () => vencimientoCertificadoMantenimiento
  });

  // cxobra/mantenimiento/normativa/src/fechas.ts
  var PATRON = /^(\d{4})-(\d{2})-(\d{2})$/;
  function diasDelMes(anio, mes) {
    return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  }
  function partes(fecha) {
    const m = PATRON.exec(fecha);
    if (!m) throw new RangeError(`Fecha no v\xE1lida (se espera AAAA-MM-DD): ${fecha}`);
    const anio = Number(m[1]);
    const mes = Number(m[2]);
    const dia = Number(m[3]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
      throw new RangeError(`Fecha inexistente: ${fecha}`);
    }
    return { anio, mes, dia };
  }
  function esFechaValida(fecha) {
    try {
      partes(fecha);
      return true;
    } catch {
      return false;
    }
  }
  function formatear(anio, mes, dia) {
    return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  function comparar(a, b) {
    partes(a);
    partes(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function esAnterior(a, b) {
    return comparar(a, b) < 0;
  }
  function desde(a, b) {
    return comparar(a, b) >= 0;
  }
  function sumarMeses(fecha, meses) {
    if (!Number.isInteger(meses)) throw new RangeError("Los meses deben ser enteros");
    const { anio, mes, dia } = partes(fecha);
    const total = anio * 12 + (mes - 1) + meses;
    const nuevoAnio = Math.floor(total / 12);
    const nuevoMes = total % 12 + 1;
    const nuevoDia = Math.min(dia, diasDelMes(nuevoAnio, nuevoMes));
    return formatear(nuevoAnio, nuevoMes, nuevoDia);
  }
  function sumarAnios(fecha, anios) {
    return sumarMeses(fecha, anios * 12);
  }
  function sumarDias(fecha, dias) {
    const { anio, mes, dia } = partes(fecha);
    const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
    return formatear(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  function diasEntre(a, b) {
    const pa = partes(a);
    const pb = partes(b);
    const ms = Date.UTC(pb.anio, pb.mes - 1, pb.dia) - Date.UTC(pa.anio, pa.mes - 1, pa.dia);
    return Math.round(ms / 864e5);
  }
  var MESES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ];
  function fechaLarga(fecha) {
    const { anio, mes, dia } = partes(fecha);
    return `${dia} de ${MESES[mes - 1]} de ${anio}`;
  }

  // cxobra/mantenimiento/normativa/src/fuentes.ts
  var URL2 = {
    fgas: "https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:32024R0573",
    fgasEN: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R0573",
    sao: "https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:32024R0590",
    rd115: "https://www.boe.es/buscar/act.php?id=BOE-A-2017-1679",
    rite: "https://www.boe.es/buscar/act.php?id=BOE-A-2007-15820",
    riteOriginal: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2007-15820"
  };
  function refFgas(cita, ancla) {
    return { norma: "Reglamento (UE) 2024/573", cita, url: ancla ? `${URL2.fgas}#${ancla}` : URL2.fgas };
  }
  function refSao(cita, ancla) {
    return { norma: "Reglamento (UE) 2024/590", cita, url: ancla ? `${URL2.sao}#${ancla}` : URL2.sao };
  }
  function refRd115(cita, ancla) {
    return { norma: "Real Decreto 115/2017", cita, url: ancla ? `${URL2.rd115}#${ancla}` : URL2.rd115 };
  }
  function refRite(cita, ancla) {
    return { norma: "RITE (Real Decreto 1027/2007)", cita, url: ancla ? `${URL2.rite}#${ancla}` : URL2.rite };
  }
  function citar(r) {
    return `${r.norma}, ${r.cita}`;
  }
  var ENTRADA_EN_VIGOR_FGAS = "2024-03-11";

  // cxobra/mantenimiento/normativa/src/refrigerantes.ts
  var SUSTANCIAS = {
    "HFC-32": { designacion: "HFC-32 (difluorometano)", pca: 675, anexo: "I-1", referencia: refFgas("anexo I, secci\xF3n 1") },
    "HFC-125": { designacion: "HFC-125 (pentafluoretano)", pca: 3500, anexo: "I-1", referencia: refFgas("anexo I, secci\xF3n 1") },
    "HFC-134a": { designacion: "HFC-134a (1,1,1,2-tetrafluoroetano)", pca: 1430, anexo: "I-1", referencia: refFgas("anexo I, secci\xF3n 1") },
    "HFC-143a": { designacion: "HFC-143a (1,1,1-trifluoroetano)", pca: 4470, anexo: "I-1", referencia: refFgas("anexo I, secci\xF3n 1") },
    "HFC-1234yf": { designacion: "HFC-1234yf", pca: 0.501, anexo: "II-1", referencia: refFgas("anexo II, secci\xF3n 1") },
    "HFC-1234ze": { designacion: "HFC-1234ze e is\xF3meros", pca: 1.37, anexo: "II-1", referencia: refFgas("anexo II, secci\xF3n 1") },
    "R-290": { designacion: "propano (R-290)", pca: 0.02, anexo: "VI", referencia: refFgas("anexo VI") },
    "R-600a": { designacion: "isobutano (R-600a)", pca: 0, anexo: "VI", referencia: refFgas("anexo VI") },
    "R-717": { designacion: "amoniaco (R-717)", pca: 0, anexo: "VI", referencia: refFgas("anexo VI") },
    "R-744": { designacion: "di\xF3xido de carbono (R-744)", pca: 1, anexo: "CO2", referencia: refFgas("art. 3, punto 1 (referencia del PCA: 1 kg de CO2)", "art_3") },
    "HCFC-22": { designacion: "HCFC-22 (clorodifluorometano)", pca: 1960, pao: 0.055, anexo: "SAO-I", referencia: refSao("anexo I, grupo VIII") }
  };
  var DEFINICIONES = {
    R32: { nombre: "R32", composicion: [{ sustancia: "HFC-32", porcentaje: 100 }] },
    R410A: { nombre: "R410A", composicion: [{ sustancia: "HFC-32", porcentaje: 50 }, { sustancia: "HFC-125", porcentaje: 50 }] },
    R407C: {
      nombre: "R407C",
      composicion: [{ sustancia: "HFC-32", porcentaje: 23 }, { sustancia: "HFC-125", porcentaje: 25 }, { sustancia: "HFC-134a", porcentaje: 52 }]
    },
    R404A: {
      nombre: "R404A",
      composicion: [{ sustancia: "HFC-125", porcentaje: 44 }, { sustancia: "HFC-143a", porcentaje: 52 }, { sustancia: "HFC-134a", porcentaje: 4 }]
    },
    R507A: { nombre: "R507A", composicion: [{ sustancia: "HFC-125", porcentaje: 50 }, { sustancia: "HFC-143a", porcentaje: 50 }] },
    R134a: { nombre: "R134a", composicion: [{ sustancia: "HFC-134a", porcentaje: 100 }] },
    R422D: {
      nombre: "R422D",
      composicion: [{ sustancia: "HFC-125", porcentaje: 65.1 }, { sustancia: "HFC-134a", porcentaje: 31.5 }, { sustancia: "R-600a", porcentaje: 3.4 }]
    },
    R427A: {
      nombre: "R427A",
      composicion: [
        { sustancia: "HFC-32", porcentaje: 15 },
        { sustancia: "HFC-125", porcentaje: 25 },
        { sustancia: "HFC-143a", porcentaje: 10 },
        { sustancia: "HFC-134a", porcentaje: 50 }
      ]
    },
    R448A: {
      nombre: "R448A",
      composicion: [
        { sustancia: "HFC-32", porcentaje: 26 },
        { sustancia: "HFC-125", porcentaje: 26 },
        { sustancia: "HFC-1234yf", porcentaje: 20 },
        { sustancia: "HFC-134a", porcentaje: 21 },
        { sustancia: "HFC-1234ze", porcentaje: 7 }
      ]
    },
    R449A: {
      nombre: "R449A",
      composicion: [
        { sustancia: "HFC-32", porcentaje: 24.3 },
        { sustancia: "HFC-125", porcentaje: 24.7 },
        { sustancia: "HFC-1234yf", porcentaje: 25.3 },
        { sustancia: "HFC-134a", porcentaje: 25.7 }
      ]
    },
    R452A: {
      nombre: "R452A",
      composicion: [{ sustancia: "HFC-1234yf", porcentaje: 30 }, { sustancia: "HFC-32", porcentaje: 11 }, { sustancia: "HFC-125", porcentaje: 59 }]
    },
    R454B: { nombre: "R454B", composicion: [{ sustancia: "HFC-32", porcentaje: 68.9 }, { sustancia: "HFC-1234yf", porcentaje: 31.1 }] },
    R454C: { nombre: "R454C", composicion: [{ sustancia: "HFC-32", porcentaje: 21.5 }, { sustancia: "HFC-1234yf", porcentaje: 78.5 }] },
    R513A: { nombre: "R513A", composicion: [{ sustancia: "HFC-1234yf", porcentaje: 56 }, { sustancia: "HFC-134a", porcentaje: 44 }] },
    R1234yf: { nombre: "R1234yf", composicion: [{ sustancia: "HFC-1234yf", porcentaje: 100 }] },
    "R1234ze(E)": {
      nombre: "R1234ze(E)",
      composicion: [{ sustancia: "HFC-1234ze", porcentaje: 100 }],
      nota: "El anexo II da un \xFAnico PCA (1,37) para \xABHFC-1234ze e is\xF3meros\xBB."
    },
    R290: { nombre: "R290 (propano)", composicion: [{ sustancia: "R-290", porcentaje: 100 }] },
    R600a: { nombre: "R600a (isobutano)", composicion: [{ sustancia: "R-600a", porcentaje: 100 }] },
    R744: { nombre: "R744 (CO2)", composicion: [{ sustancia: "R-744", porcentaje: 100 }] },
    R717: { nombre: "R717 (amoniaco)", composicion: [{ sustancia: "R-717", porcentaje: 100 }] },
    R22: {
      nombre: "R22",
      composicion: [{ sustancia: "HCFC-22", porcentaje: 100 }],
      nota: "HCFC: sustancia que agota la capa de ozono (Reglamento (UE) 2024/590). Su uso est\xE1 prohibido (art. 4.1). Su PCA (1 960, AR6) es informativo: muchas fichas antiguas usan 1 810 (AR4)."
    }
  };
  function limpiar(x, decimales = 6) {
    const f = 10 ** decimales;
    return Math.round(x * f) / f;
  }
  function pcaMezcla(composicion) {
    const suma = composicion.reduce((s, c) => s + c.porcentaje, 0);
    if (Math.abs(suma - 100) > 1e-9) {
      throw new RangeError(`La composici\xF3n debe sumar 100 % (suma ${suma} %)`);
    }
    return limpiar(composicion.reduce((s, c) => s + c.porcentaje / 100 * c.pca, 0));
  }
  function claseDe(componentes) {
    const anexos = componentes.map((c) => SUSTANCIAS[c].anexo);
    if (anexos.includes("I-1")) return "HFC";
    if (anexos.includes("SAO-I")) return "SAO";
    if (anexos.includes("II-1")) return "HFO";
    return "natural";
  }
  function construir(id) {
    const def = DEFINICIONES[id];
    const composicion = def.composicion.map((c) => ({ ...c, pca: SUSTANCIAS[c.sustancia].pca }));
    const esMezcla = composicion.length > 1;
    const clase = claseDe(composicion.map((c) => c.sustancia));
    const pca = esMezcla ? pcaMezcla(composicion) : composicion[0].pca;
    const sustancias = composicion.map((c) => SUSTANCIAS[c.sustancia]);
    const referencias = [];
    for (const s of sustancias) {
      if (!referencias.some((r2) => r2.cita === s.referencia.cita && r2.norma === s.referencia.norma)) referencias.push(s.referencia);
    }
    if (esMezcla) referencias.push(refFgas("anexo VI (m\xE9todo de c\xE1lculo del PCG de una mezcla)"));
    if (clase === "HFC" && esMezcla) referencias.push(refFgas("art. 3, punto 4 (una mezcla que contiene un HFC es HFC)", "art_3"));
    const metodoPca = esMezcla ? `Media ponderada (anexo VI): ${composicion.map((c) => `${c.porcentaje} % \xD7 ${c.pca}`).join(" + ")} = ${pca}` : `Valor del ${sustancias[0].referencia.norma}, ${sustancias[0].referencia.cita}`;
    const r = { id, nombre: def.nombre, clase, esMezcla, pca, composicion, metodoPca, referencias };
    const pao = sustancias[0].pao;
    if (pao !== void 0) r.pao = pao;
    if (def.nota) r.nota = def.nota;
    return r;
  }
  var REFRIGERANTES = Object.freeze(
    Object.fromEntries(Object.keys(DEFINICIONES).map((id) => [id, construir(id)]))
  );
  var IDS_REFRIGERANTES = Object.keys(DEFINICIONES);
  function buscarRefrigerante(texto2) {
    const limpio = texto2.toUpperCase().replace(/[\s-]/g, "");
    const alias = { R1234ZE: "R1234ze(E)", "R1234ZE(E)": "R1234ze(E)", R507: "R507A" };
    if (alias[limpio]) return REFRIGERANTES[alias[limpio]];
    return IDS_REFRIGERANTES.map((id) => REFRIGERANTES[id]).find((r) => r.id.toUpperCase() === limpio);
  }
  function refrigerante(gas) {
    if (typeof gas !== "string") return gas;
    const r = REFRIGERANTES[gas];
    if (!r) throw new RangeError(`Refrigerante desconocido: ${gas}`);
    return r;
  }
  function esGasFluorado(gas) {
    const c = refrigerante(gas).clase;
    return c === "HFC" || c === "HFO";
  }
  function tco2e(cargaKg, gas) {
    if (!Number.isFinite(cargaKg) || cargaKg < 0) throw new RangeError(`Carga no v\xE1lida: ${cargaKg}`);
    return limpiar(cargaKg * refrigerante(gas).pca / 1e3);
  }
  function formatearTco2e(t) {
    const truncado = Math.floor(limpiar(t * 100, 6)) / 100;
    return `${truncado.toFixed(2).replace(".", ",")} t CO2e`;
  }
  function formatearPca(pca) {
    return Number.isInteger(pca) ? String(pca) : (Math.round(pca * 100) / 100).toString().replace(".", ",");
  }
  function numeroES(n) {
    return String(n).replace(".", ",");
  }
  function cargaParaTco2e(toneladas, gas) {
    const pca = refrigerante(gas).pca;
    if (pca === 0) return Number.POSITIVE_INFINITY;
    let kg2 = Math.ceil(limpiar(toneladas * 1e9 / pca, 3)) / 1e6;
    while (tco2e(kg2, gas) < toneladas) kg2 = limpiar(kg2 + 1e-6);
    return kg2;
  }

  // cxobra/mantenimiento/normativa/src/fgas.ts
  var REF_ART5_1 = refFgas("art. 5, apdo. 1", "art_5");
  var REF_ART5_6 = (letra) => refFgas(`art. 5, apdo. 6, letra ${letra})`, "art_5");
  var REF_ART6_1 = refFgas("art. 6, apdo. 1", "art_6");
  var REF_ART6_3 = refFgas("art. 6, apdo. 3", "art_6");
  var REF_SAO_21_3 = (letra) => refSao(`art. 21, apdo. 3, letra ${letra})`, "art_21");
  function exentoPorHermetico(eq, r, t) {
    if (!eq.selladoHermeticoEtiquetado) return null;
    if (r.clase === "HFC" && t < 10) return `es un equipo sellado herm\xE9ticamente y etiquetado con menos de 10 t CO2e de HFC (${formatearTco2e(t)})`;
    if (r.clase === "HFO" && eq.cargaKg < 2) return `es un equipo sellado herm\xE9ticamente y etiquetado con menos de 2 kg de HFO (${numeroES(eq.cargaKg)} kg)`;
    if (eq.enEdificioResidencial && eq.cargaKg < 3) {
      return `es un equipo sellado herm\xE9ticamente y etiquetado, instalado en un edificio residencial, con menos de 3 kg de gas fluorado (${numeroES(eq.cargaKg)} kg)`;
    }
    return null;
  }
  function controlFugas(eq) {
    const r = refrigerante(eq.gas);
    if (!Number.isFinite(eq.cargaKg) || eq.cargaKg < 0) throw new RangeError(`Carga no v\xE1lida: ${eq.cargaKg}`);
    const deteccion = !!eq.sistemaDeteccionFugas;
    if (r.clase === "natural") {
      return {
        sujeto: false,
        periodicidadMeses: null,
        magnitud: { valor: eq.cargaKg, unidad: "kg" },
        tramo: null,
        deteccionObligatoria: false,
        faltaDeteccion: false,
        explicacion: `El ${r.nombre} no es un gas fluorado: el Reglamento 2024/573 no le exige control de fugas (s\xED aplica la seguridad industrial: RSIF, que este motor no cubre).`,
        referencias: [REF_ART5_1]
      };
    }
    if (r.clase === "SAO") {
      const kg2 = eq.cargaKg;
      const ref = [refSao("art. 21, apdo. 3", "art_21")];
      if (kg2 < 3 || eq.selladoHermeticoEtiquetado && kg2 < 6) {
        const motivo = kg2 < 3 ? `tiene menos de 3 kg (${numeroES(kg2)} kg)` : `es sellado herm\xE9ticamente, etiquetado y tiene menos de 6 kg (${numeroES(kg2)} kg)`;
        return {
          sujeto: false,
          periodicidadMeses: null,
          magnitud: { valor: kg2, unidad: "kg" },
          tramo: null,
          deteccionObligatoria: false,
          faltaDeteccion: false,
          explicacion: `Equipo de ${r.nombre} (sustancia que agota la capa de ozono): no est\xE1 sujeto a control peri\xF3dico de fugas porque ${motivo}.`,
          referencias: ref
        };
      }
      const [meses2, tramo2, letra2] = kg2 < 30 ? [12, "bajo", "a"] : kg2 < 300 ? [6, "medio", "b"] : [3, "alto", "c"];
      return {
        sujeto: true,
        periodicidadMeses: meses2,
        magnitud: { valor: kg2, unidad: "kg" },
        tramo: tramo2,
        deteccionObligatoria: false,
        faltaDeteccion: false,
        explicacion: `Equipo de ${r.nombre} con ${numeroES(kg2)} kg: control de fugas al menos cada ${meses2} meses. Recuerde que el R22 no se puede recargar (Reglamento 2024/590, art. 4.1).`,
        referencias: [REF_SAO_21_3(letra2)]
      };
    }
    const esHfc2 = r.clase === "HFC";
    const valor = esHfc2 ? tco2e(eq.cargaKg, r) : eq.cargaKg;
    const unidad = esHfc2 ? "t CO2e" : "kg";
    const [u1, u2, u3] = esHfc2 ? [5, 50, 500] : [1, 10, 100];
    const textoValor = esHfc2 ? formatearTco2e(valor) : `${numeroES(valor)} kg`;
    const tipo = esHfc2 ? r.esMezcla && r.composicion.some((c) => c.sustancia.startsWith("HFC-1234")) ? "mezcla HFC+HFO (cuenta como HFC)" : "HFC" : "HFO";
    const deteccionObligatoria = valor >= u3;
    const refsDeteccion = deteccionObligatoria ? [REF_ART6_1] : [];
    if (valor < u1) {
      return {
        sujeto: false,
        periodicidadMeses: null,
        magnitud: { valor, unidad },
        tramo: null,
        deteccionObligatoria: false,
        faltaDeteccion: false,
        explicacion: `${r.nombre} (${tipo}) con ${numeroES(eq.cargaKg)} kg = ${textoValor}: por debajo de ${u1} ${esHfc2 ? "t CO2e" : "kg"}, no est\xE1 sujeto a control de fugas.`,
        referencias: [REF_ART5_1]
      };
    }
    const hermetico = exentoPorHermetico(eq, r, esHfc2 ? valor : 0);
    if (hermetico) {
      return {
        sujeto: false,
        periodicidadMeses: null,
        magnitud: { valor, unidad },
        tramo: null,
        deteccionObligatoria: false,
        faltaDeteccion: false,
        explicacion: `No est\xE1 sujeto a control de fugas porque ${hermetico}.`,
        referencias: [refFgas("art. 5, apdo. 1, p\xE1rrafos segundo y tercero", "art_5")]
      };
    }
    const [tramo, base2, letra] = valor < u2 ? ["bajo", 12, "a"] : valor < u3 ? ["medio", 6, "b"] : ["alto", 3, "c"];
    const meses = deteccion ? base2 * 2 : base2;
    const faltaDeteccion = deteccionObligatoria && !deteccion;
    let explicacion = `${r.nombre} (${tipo}) con ${numeroES(eq.cargaKg)} kg = ${textoValor}: control de fugas al menos cada ${meses} meses`;
    explicacion += deteccion ? " (tiene sistema de detecci\xF3n de fugas, que duplica el plazo)." : ".";
    if (faltaDeteccion) {
      explicacion += ` ATENCI\xD3N: con ${esHfc2 ? "500 t CO2e" : "100 kg"} o m\xE1s es obligatorio un sistema de detecci\xF3n de fugas y este equipo no lo tiene.`;
    }
    return {
      sujeto: true,
      periodicidadMeses: meses,
      magnitud: { valor, unidad },
      tramo,
      deteccionObligatoria,
      faltaDeteccion,
      explicacion,
      referencias: [REF_ART5_1, REF_ART5_6(letra), ...refsDeteccion]
    };
  }
  function proximoControlFugas(eq, ultimoControl2, hoy) {
    const c = controlFugas(eq);
    if (!c.sujeto || c.periodicidadMeses === null) {
      return { fechaLimite: null, vencido: false, diasRestantes: null, explicacion: c.explicacion, referencias: c.referencias };
    }
    if (ultimoControl2 === null) {
      return {
        fechaLimite: null,
        vencido: true,
        diasRestantes: null,
        explicacion: `No consta ning\xFAn control de fugas y el equipo est\xE1 sujeto (cada ${c.periodicidadMeses} meses): hay que hacerlo ya.`,
        referencias: c.referencias
      };
    }
    const fechaLimite = sumarMeses(ultimoControl2, c.periodicidadMeses);
    const diasRestantes = diasEntre(hoy, fechaLimite);
    const vencido = diasRestantes < 0;
    return {
      fechaLimite,
      vencido,
      diasRestantes,
      explicacion: vencido ? `El control de fugas venci\xF3 el ${fechaLarga(fechaLimite)} (\xFAltimo: ${fechaLarga(ultimoControl2)}, cada ${c.periodicidadMeses} meses).` : `Pr\xF3ximo control de fugas como tarde el ${fechaLarga(fechaLimite)} (quedan ${diasRestantes} d\xEDas).`,
      referencias: c.referencias
    };
  }
  function comprobacionTrasReparacion(eq, fechaReparacion) {
    const c = controlFugas(eq);
    const ref = refFgas("art. 4, apdo. 5, p\xE1rrafo segundo", "art_4");
    if (!c.sujeto || refrigerante(eq.gas).clase === "SAO") {
      return {
        obligatoria: false,
        noAntesDe: null,
        fechaLimite: null,
        explicacion: "El equipo no est\xE1 sujeto a control de fugas del art. 5, as\xED que no rige el plazo de comprobaci\xF3n tras la reparaci\xF3n (la fuga debe repararse igualmente sin demora indebida).",
        referencias: [ref]
      };
    }
    const fechaLimite = sumarMeses(fechaReparacion, 1);
    return {
      obligatoria: true,
      noAntesDe: sumarDias(fechaReparacion, 1),
      fechaLimite,
      explicacion: `Tras reparar la fuga, un t\xE9cnico certificado debe comprobar que la reparaci\xF3n funciona: despu\xE9s de 24 h de funcionamiento y como tarde el ${fechaLarga(fechaLimite)}.`,
      referencias: [ref]
    };
  }
  function deteccionFugas(eq, ultimoControlDeteccion) {
    const c = controlFugas(eq);
    const tiene = !!eq.sistemaDeteccionFugas;
    const obligatoria = c.deteccionObligatoria;
    const proximoControl = tiene && ultimoControlDeteccion ? sumarMeses(ultimoControlDeteccion, 12) : null;
    let explicacion;
    if (obligatoria && !tiene) explicacion = "Es obligatorio instalar un sistema de detecci\xF3n de fugas que avise al operador o al mantenedor, y el equipo no lo tiene.";
    else if (obligatoria) explicacion = "El sistema de detecci\xF3n de fugas es obligatorio y debe revisarse al menos cada 12 meses.";
    else if (tiene) explicacion = "El sistema de detecci\xF3n no es obligatorio en este equipo; se recomienda revisarlo cada 12 meses porque justifica el plazo doble de control de fugas.";
    else explicacion = "No es obligatorio un sistema de detecci\xF3n de fugas.";
    if (tiene && !ultimoControlDeteccion && obligatoria) explicacion += " No consta ninguna revisi\xF3n del sistema: hay que hacerla ya.";
    return {
      obligatoria,
      tiene,
      proximoControl,
      explicacion,
      referencias: obligatoria ? [REF_ART6_1, REF_ART6_3] : [REF_ART6_1]
    };
  }
  var ORIGEN_TXT = { virgen: "gas virgen", regenerado: "gas regenerado", reciclado: "gas reciclado" };
  function condicionesOrigen(origen, opciones) {
    if (origen === "regenerado") {
      return { vale: true, condiciones: ["El recipiente del gas regenerado debe estar etiquetado conforme al art. 12, apdo. 7 (indica que es regenerado, lote y planta)."] };
    }
    if (origen === "reciclado") {
      if (opciones.recicladoPorLaMismaEmpresa === false) {
        return {
          vale: false,
          condiciones: [],
          motivo: "el gas reciclado solo puede usarlo la empresa que lo recuper\xF3 (o la empresa para la que se recuper\xF3), y solo si procede de equipos de este tipo"
        };
      }
      return { vale: true, condiciones: ["El gas reciclado debe haberse recuperado de equipos de este tipo y solo puede usarlo la empresa que lo recuper\xF3 o aquella para la que se recuper\xF3."] };
    }
    return { vale: false, condiciones: [] };
  }
  function puedeRecargar(equipo2, gas, origen, fecha, opciones = {}) {
    if (esAnterior(fecha, ENTRADA_EN_VIGOR_FGAS)) {
      throw new RangeError(`El motor solo eval\xFAa fechas desde la entrada en vigor del Reglamento 2024/573 (${ENTRADA_EN_VIGOR_FGAS}).`);
    }
    const r = refrigerante(gas);
    const pca = formatearPca(r.pca);
    const cuando = `el ${fechaLarga(fecha)}`;
    if (r.clase === "SAO") {
      return {
        permitido: false,
        explicacion: `No. El ${r.nombre} es una sustancia que agota la capa de ozono y su uso est\xE1 prohibido, tambi\xE9n para recargar equipos existentes, sea virgen, regenerado o reciclado. Solo puede recuperarse para destruirlo, reciclarlo o regenerarlo.`,
        condiciones: [],
        referencias: [refSao("art. 4, apdo. 1", "art_4"), refSao("art. 20, apdo. 1 (recuperaci\xF3n)", "art_20")]
      };
    }
    if (r.clase === "natural") {
      return {
        permitido: true,
        explicacion: `S\xED. El ${r.nombre} no es un gas fluorado: el art. 13 del Reglamento 2024/573 no limita su uso en mantenimiento.`,
        condiciones: [],
        referencias: [refFgas("art. 13", "art_13")]
      };
    }
    const esAnexoI = r.clase === "HFC";
    const condiciones = [];
    const referencias = [];
    if (equipo2.uso === "refrigeracion" && r.pca >= 2500) {
      const exento = equipo2.exencion === "militar" || equipo2.exencion === "productos_bajo_menos_50C" || equipo2.exencion === "medicamentos_bajo_menos_50C";
      const t = tco2e(equipo2.cargaKg, r);
      const aplica = desde(fecha, "2025-01-01") || t >= 40;
      if (aplica && !exento) {
        const ref = refFgas("art. 13, apdo. 3", "art_13");
        const reglaTxt = desde(fecha, "2025-01-01") ? "desde el 1 de enero de 2025 no se puede usar gas fluorado con PCA de 2 500 o m\xE1s para mantener ning\xFAn equipo de refrigeraci\xF3n" : `antes de 2025 la prohibici\xF3n afecta a los equipos de refrigeraci\xF3n de 40 t CO2e o m\xE1s, y este tiene ${formatearTco2e(t)}`;
        if (origen === "virgen" || !esAnexoI || desde(fecha, "2030-01-01")) {
          const motivoReciclado = origen !== "virgen" && desde(fecha, "2030-01-01") ? " La excepci\xF3n para gas regenerado o reciclado termin\xF3 el 1 de enero de 2030." : "";
          return {
            permitido: false,
            explicacion: `No. El ${r.nombre} tiene un PCA de ${pca} y ${reglaTxt}.${motivoReciclado} ${origen === "virgen" && esAnexoI && esAnterior(fecha, "2030-01-01") ? "Hasta el 1 de enero de 2030 s\xED se puede usar gas regenerado o reciclado." : ""}`.trim(),
            condiciones: [],
            referencias: [ref]
          };
        }
        const o = condicionesOrigen(origen, opciones);
        if (!o.vale) {
          return { permitido: false, explicacion: `No. Con PCA ${pca} solo se admite gas regenerado o reciclado, y ${o.motivo}.`, condiciones: [], referencias: [ref] };
        }
        condiciones.push(...o.condiciones, "Solo para equipos existentes; excepci\xF3n v\xE1lida hasta el 31 de diciembre de 2029.");
        referencias.push(ref);
      }
    }
    if (equipo2.uso === "climatizacion" && esAnexoI && r.pca >= 2500 && desde(fecha, "2026-01-01")) {
      const ref = refFgas("art. 13, apdo. 4", "art_13");
      if (origen === "virgen" || desde(fecha, "2032-01-01")) {
        const extra = origen === "virgen" ? esAnterior(fecha, "2032-01-01") ? " Hasta el 1 de enero de 2032 s\xED se puede usar gas regenerado o reciclado." : "" : " La excepci\xF3n para gas regenerado o reciclado termin\xF3 el 1 de enero de 2032.";
        return {
          permitido: false,
          explicacion: `No. El ${r.nombre} tiene un PCA de ${pca} y desde el 1 de enero de 2026 no se puede usar gas con PCA de 2 500 o m\xE1s para mantener equipos de aire acondicionado ni bombas de calor.${extra}`,
          condiciones: [],
          referencias: [ref]
        };
      }
      const o = condicionesOrigen(origen, opciones);
      if (!o.vale) {
        return { permitido: false, explicacion: `No. Con PCA ${pca} solo se admite gas regenerado o reciclado, y ${o.motivo}.`, condiciones: [], referencias: [ref] };
      }
      condiciones.push(...o.condiciones, "Solo para equipos existentes; excepci\xF3n v\xE1lida hasta el 31 de diciembre de 2031.");
      referencias.push(ref);
    }
    if (equipo2.uso === "refrigeracion" && !equipo2.esEnfriadora && esAnexoI && r.pca >= 750 && desde(fecha, "2032-01-01")) {
      const exento = equipo2.exencion === "militar" || equipo2.exencion === "medicamentos_bajo_menos_50C" || equipo2.exencion === "centrales_nucleares";
      if (!exento) {
        const ref = refFgas("art. 13, apdo. 5", "art_13");
        if (origen === "virgen") {
          return {
            permitido: false,
            explicacion: `No. El ${r.nombre} tiene un PCA de ${pca} y desde el 1 de enero de 2032 no se puede usar gas virgen con PCA de 750 o m\xE1s para mantener equipos fijos de refrigeraci\xF3n (salvo enfriadores). S\xED se admite gas regenerado o reciclado.`,
            condiciones: [],
            referencias: [ref]
          };
        }
        const o = condicionesOrigen(origen, opciones);
        if (!o.vale) {
          return { permitido: false, explicacion: `No. Con PCA ${pca} solo se admite gas regenerado o reciclado, y ${o.motivo}.`, condiciones: [], referencias: [ref] };
        }
        for (const c of o.condiciones) if (!condiciones.includes(c)) condiciones.push(c);
        referencias.push(ref);
      }
    }
    if (referencias.length === 0) {
      const motivo = r.pca < 750 ? `su PCA (${pca}) est\xE1 por debajo de todos los l\xEDmites del art. 13` : r.pca < 2500 && equipo2.exencion && desde(fecha, "2032-01-01") && equipo2.uso === "refrigeracion" && !equipo2.esEnfriadora && esAnexoI ? "el equipo est\xE1 en una de las exenciones del art. 13" : r.pca < 2500 ? `su PCA (${pca}) es inferior a 2 500${equipo2.uso === "refrigeracion" && !equipo2.esEnfriadora && esAnexoI ? " (el l\xEDmite de 750 para refrigeraci\xF3n fija empieza el 1 de enero de 2032)" : ""}` : equipo2.exencion ? "el equipo est\xE1 en una de las exenciones del art. 13" : equipo2.uso === "climatizacion" ? "la prohibici\xF3n para aire acondicionado y bomba de calor empieza el 1 de enero de 2026" : "la carga del equipo es inferior a 40 t CO2e (regla vigente hasta el 31 de diciembre de 2024)";
      return {
        permitido: true,
        explicacion: `S\xED. Se puede recargar ${cuando} con ${ORIGEN_TXT[origen]} de ${r.nombre}: ${motivo}.`,
        condiciones,
        referencias: [refFgas("art. 13, apdos. 3 a 5", "art_13")]
      };
    }
    return {
      permitido: true,
      explicacion: `S\xED, pero solo porque es ${ORIGEN_TXT[origen]}: con ${ORIGEN_TXT.virgen} de ${r.nombre} (PCA ${pca}) estar\xEDa prohibido.`,
      condiciones,
      referencias
    };
  }
  var esFluorado = (r) => r.clase === "HFC" || r.clase === "HFO";
  var esHfc = (r) => r.clase === "HFC";
  var REGLAS_IV = [
    // Punto 4
    {
      punto: "4",
      fecha: "2025-01-01",
      excepcionSeguridad: true,
      descripcion: "Aparato de refrigeraci\xF3n aut\xF3nomo (salvo enfriadores) con gas fluorado de PCA \u2265 150.",
      aplica: (e, r) => e.categoria === "refrigeracion_autonoma" && esFluorado(r) && r.pca >= 150
    },
    // Punto 5 (refrigeración no autónoma, excepto enfriadores y puntos 4 y 6)
    {
      punto: "5 a)",
      fecha: "2020-01-01",
      excepcionSeguridad: false,
      descripcion: "Aparatos de refrigeraci\xF3n con HFC de PCA \u2265 2 500 (salvo aplicaciones por debajo de -50 \xB0C).",
      aplica: (e, r) => esPunto5(e) && esHfc(r) && r.pca >= 2500 && !e.productosBajoMenos50C
    },
    {
      punto: "5 b)",
      fecha: "2025-01-01",
      excepcionSeguridad: false,
      descripcion: "Aparatos de refrigeraci\xF3n con gas fluorado de PCA \u2265 2 500 (salvo aplicaciones por debajo de -50 \xB0C).",
      aplica: (e, r) => esPunto5(e) && esFluorado(r) && r.pca >= 2500 && !e.productosBajoMenos50C
    },
    {
      punto: "5 c)",
      fecha: "2030-01-01",
      excepcionSeguridad: true,
      descripcion: "Aparatos de refrigeraci\xF3n con gas fluorado de PCA \u2265 150.",
      aplica: (e, r) => esPunto5(e) && esFluorado(r) && r.pca >= 150
    },
    // Punto 6
    {
      punto: "6",
      fecha: "2022-01-01",
      excepcionSeguridad: false,
      descripcion: "Central frigor\xEDfica multicompresor compacta comercial de 40 kW o m\xE1s con gas del anexo I de PCA \u2265 150 (en el circuito primario de una cascada se admite PCA < 1 500).",
      aplica: (e, r) => e.categoria === "central_multicompresor" && e.potenciaKw >= 40 && esHfc(r) && r.pca >= 150 && !(e.circuitoPrimarioCascada && r.pca < 1500)
    },
    // Punto 7: enfriadores
    {
      punto: "7 a)",
      fecha: "2020-01-01",
      excepcionSeguridad: false,
      descripcion: "Enfriadores con HFC de PCA \u2265 2 500 (salvo aplicaciones por debajo de -50 \xB0C).",
      aplica: (e, r) => e.categoria === "enfriadora" && esHfc(r) && r.pca >= 2500 && !e.productosBajoMenos50C
    },
    {
      punto: "7 b)",
      fecha: "2027-01-01",
      excepcionSeguridad: true,
      descripcion: "Enfriadores de hasta 12 kW con gas fluorado de PCA \u2265 150.",
      aplica: (e, r) => e.categoria === "enfriadora" && e.potenciaKw <= 12 && esFluorado(r) && r.pca >= 150
    },
    {
      punto: "7 c)",
      fecha: "2032-01-01",
      excepcionSeguridad: true,
      descripcion: "Enfriadores de hasta 12 kW con cualquier gas fluorado.",
      aplica: (e, r) => e.categoria === "enfriadora" && e.potenciaKw <= 12 && esFluorado(r)
    },
    {
      punto: "7 d)",
      fecha: "2027-01-01",
      excepcionSeguridad: true,
      descripcion: "Enfriadores de m\xE1s de 12 kW con gas fluorado de PCA \u2265 750.",
      aplica: (e, r) => e.categoria === "enfriadora" && e.potenciaKw > 12 && esFluorado(r) && r.pca >= 750,
      nota: "El texto dice \xABcon un PCG de 750\xBB (tambi\xE9n en ingl\xE9s, \xABGWP of 750\xBB), sin \xABigual o superior\xBB. Se interpreta como \u2265 750, igual que el resto del anexo. TODO(verificar) si se publica correcci\xF3n de errores."
    },
    // Punto 8: autónomos de AA y BC (salvo enfriadores)
    {
      punto: "8 a)",
      fecha: "2020-01-01",
      excepcionSeguridad: false,
      descripcion: "Aire acondicionado port\xE1til enchufable (se mueve de habitaci\xF3n) con HFC de PCA \u2265 150.",
      aplica: (e, r) => e.categoria === "portatil" && esHfc(r) && r.pca >= 150
    },
    {
      punto: "8 b)",
      fecha: "2027-01-01",
      excepcionSeguridad: true,
      descripcion: "AA y bombas de calor aut\xF3nomos (monobloque y otros) de hasta 12 kW con gas fluorado de PCA \u2265 150 (si la seguridad impide bajar de 150, el l\xEDmite es 750).",
      aplica: (e, r) => (e.categoria === "autonomo" || e.categoria === "portatil") && e.potenciaKw <= 12 && esFluorado(r) && r.pca >= 150,
      nota: "La versi\xF3n espa\xF1ola dice \xABenchufables para espacios cerrados\xBB; la inglesa aplica a todos los aut\xF3nomos de hasta 12 kW (\xABplug-in room..., monoblock..., other self-contained...\xBB). Se sigue la inglesa."
    },
    {
      punto: "8 c)",
      fecha: "2032-01-01",
      excepcionSeguridad: true,
      descripcion: "AA y bombas de calor aut\xF3nomos de hasta 12 kW con cualquier gas fluorado (si la seguridad lo impide, l\xEDmite de PCA 750).",
      aplica: (e, r) => (e.categoria === "autonomo" || e.categoria === "portatil") && e.potenciaKw <= 12 && esFluorado(r)
    },
    {
      punto: "8 d)",
      fecha: "2027-01-01",
      excepcionSeguridad: true,
      descripcion: "AA y bombas de calor aut\xF3nomos de m\xE1s de 12 kW y hasta 50 kW con gas fluorado de PCA \u2265 150 (si la seguridad lo impide, l\xEDmite 750).",
      aplica: (e, r) => e.categoria === "autonomo" && e.potenciaKw > 12 && e.potenciaKw <= 50 && esFluorado(r) && r.pca >= 150
    },
    {
      punto: "8 e)",
      fecha: "2030-01-01",
      excepcionSeguridad: true,
      descripcion: "Resto de AA y bombas de calor aut\xF3nomos (m\xE1s de 50 kW) con gas fluorado de PCA \u2265 150 (si la seguridad lo impide, l\xEDmite 750).",
      aplica: (e, r) => e.categoria === "autonomo" && e.potenciaKw > 50 && esFluorado(r) && r.pca >= 150
    },
    // Punto 9: partidos
    {
      punto: "9 a)",
      fecha: "2025-01-01",
      excepcionSeguridad: false,
      descripcion: "Split simple con menos de 3 kg de gas del anexo I de PCA \u2265 750.",
      aplica: (e, r) => e.categoria === "split" && !!e.splitSimple && e.cargaKg < 3 && esHfc(r) && r.pca >= 750
    },
    {
      punto: "9 b)",
      fecha: "2027-01-01",
      excepcionSeguridad: true,
      descripcion: "Split aire-agua de hasta 12 kW con gas fluorado de PCA \u2265 150.",
      aplica: (e, r) => e.categoria === "split" && e.tipoSplit === "aire_agua" && e.potenciaKw <= 12 && esFluorado(r) && r.pca >= 150
    },
    {
      punto: "9 c)",
      fecha: "2029-01-01",
      excepcionSeguridad: true,
      descripcion: "Split aire-aire de hasta 12 kW con gas fluorado de PCA \u2265 150.",
      aplica: (e, r) => e.categoria === "split" && e.tipoSplit !== "aire_agua" && e.potenciaKw <= 12 && esFluorado(r) && r.pca >= 150
    },
    {
      punto: "9 d)",
      fecha: "2035-01-01",
      excepcionSeguridad: true,
      descripcion: "Split de hasta 12 kW con cualquier gas fluorado.",
      aplica: (e, r) => e.categoria === "split" && e.potenciaKw <= 12 && esFluorado(r)
    },
    {
      punto: "9 e)",
      fecha: "2029-01-01",
      excepcionSeguridad: true,
      descripcion: "Split de m\xE1s de 12 kW con gas fluorado de PCA \u2265 750.",
      aplica: (e, r) => e.categoria === "split" && e.potenciaKw > 12 && esFluorado(r) && r.pca >= 750
    },
    {
      punto: "9 f)",
      fecha: "2033-01-01",
      excepcionSeguridad: true,
      descripcion: "Split de m\xE1s de 12 kW con gas fluorado de PCA \u2265 150.",
      aplica: (e, r) => e.categoria === "split" && e.potenciaKw > 12 && esFluorado(r) && r.pca >= 150
    }
  ];
  function esPunto5(e) {
    return e.categoria === "refrigeracion" || e.categoria === "central_multicompresor" && e.potenciaKw < 40;
  }
  function exposicionPhaseDown(e, fecha) {
    const r = refrigerante(e.gas);
    const prohibiciones = REGLAS_IV.filter((regla) => regla.aplica(e, r)).map((regla) => {
      const p = {
        punto: regla.punto,
        fecha: regla.fecha,
        enVigor: desde(fecha, regla.fecha),
        descripcion: regla.descripcion,
        excepcionSeguridad: regla.excepcionSeguridad,
        referencia: refFgas(`anexo IV, punto ${regla.punto}`)
      };
      if (regla.nota) p.nota = regla.nota;
      return p;
    }).sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.punto < b.punto ? -1 : 1);
    const primera = prohibiciones[0] ?? null;
    const yaProhibido = prohibiciones.some((p) => p.enVigor);
    let resumen;
    if (!primera) {
      resumen = `Ninguna prohibici\xF3n del anexo IV alcanza hoy a un equipo nuevo de esta categor\xEDa con ${r.nombre}.`;
    } else if (yaProhibido) {
      const vigente = prohibiciones.find((p) => p.enVigor);
      resumen = `Desde el ${fechaLarga(vigente.fecha)} ya no se puede comprar nuevo un equipo igual con ${r.nombre} (anexo IV, punto ${vigente.punto}). El existente puede seguir funcionando y manteni\xE9ndose; al sustituirlo habr\xE1 que cambiar de gas.`;
    } else {
      resumen = `Podr\xE1 comprarse igual hasta el ${fechaLarga(sumarDias(primera.fecha, -1))}; desde el ${fechaLarga(primera.fecha)} no (anexo IV, punto ${primera.punto}).`;
    }
    return { prohibiciones, primeraFecha: primera?.fecha ?? null, yaProhibido, resumen };
  }

  // cxobra/mantenimiento/normativa/src/registros.ts
  var L = (letra) => refFgas(`art. 7, apdo. 1, letra ${letra})`, "art_7");
  var CAMPOS_REGISTRO_ART7 = [
    { campo: "gasEquipo", descripcion: "Tipo de gas contenido en el aparato", cuando: "siempre", referencia: L("a") },
    { campo: "cargaEquipoKg", descripcion: "Cantidad de gas contenida en el aparato (kg)", cuando: "siempre", referencia: L("a") },
    { campo: "cargaAnadidaEnInstalacionKg", descripcion: "Cantidad a\xF1adida durante la instalaci\xF3n, por separado", cuando: "en la instalaci\xF3n", referencia: L("a") },
    { campo: "kgAnadidos", descripcion: "Cantidad a\xF1adida en mantenimiento, revisi\xF3n o por fugas, con su fecha", cuando: "si se a\xF1ade gas", referencia: L("b") },
    { campo: "kgRecuperados", descripcion: "Cantidad de gas recuperada", cuando: "en recuperaciones y desmantelamientos", referencia: L("c") },
    { campo: "gasAnadido", descripcion: "Tipo de gas a\xF1adido", cuando: "si se a\xF1ade gas", referencia: L("d") },
    { campo: "origenGasAnadido", descripcion: "Si el gas a\xF1adido es reciclado o regenerado", cuando: "si se a\xF1ade gas", referencia: L("d") },
    { campo: "centroTratamiento", descripcion: "Nombre y direcci\xF3n en la UE del centro de reciclado o regeneraci\xF3n y, en su caso, su n\xFAmero de certificado", cuando: "si el gas a\xF1adido es reciclado o regenerado", referencia: L("d") },
    { campo: "empresa", descripcion: "Identidad de la empresa que interviene y, en su caso, su n\xFAmero de certificado", cuando: "siempre", referencia: L("e") },
    { campo: "tecnico", descripcion: "Si la empresa es persona jur\xEDdica, datos de la persona f\xEDsica que realiza la operaci\xF3n", cuando: "si la empresa es persona jur\xEDdica", referencia: L("e") },
    { campo: "fecha", descripcion: "Fecha de la intervenci\xF3n", cuando: "siempre", referencia: L("f") },
    { campo: "resultado", descripcion: "Resultado de los controles de fugas y de las reparaciones de fugas", cuando: "en controles de fugas y reparaciones", referencia: L("f") },
    { campo: "medidasRecuperacionEliminacion", descripcion: "Medidas tomadas para recuperar y eliminar los gases", cuando: "en el desmantelamiento", referencia: L("g") }
  ];
  var vacio = (s) => s === void 0 || s.trim() === "";
  var kgInvalido = (n) => n === void 0 || !Number.isFinite(n) || n < 0;
  function validarIntervencion(i) {
    const faltan = [];
    const avisos = [];
    const falta = (campo, motivo, letra) => faltan.push({ campo, motivo, referencia: L(letra) });
    if (!esFechaValida(i.fecha)) falta("fecha", "Falta la fecha de la intervenci\xF3n o no es v\xE1lida (AAAA-MM-DD).", "f");
    if (vacio(i.equipoId)) faltan.push({ campo: "equipoId", motivo: "El registro se lleva por cada parte del aparato: falta identificar el equipo.", referencia: refFgas("art. 7, apdo. 1", "art_7") });
    if (vacio(i.gasEquipo)) falta("gasEquipo", "Falta el tipo de gas que contiene el aparato.", "a");
    else if (!buscarRefrigerante(i.gasEquipo)) avisos.push(`Gas \xAB${i.gasEquipo}\xBB no reconocido en la tabla del motor: compruebe la designaci\xF3n.`);
    if (kgInvalido(i.cargaEquipoKg)) falta("cargaEquipoKg", "Falta la cantidad de gas que contiene el aparato (kg).", "a");
    if (i.tipo === "instalacion" && kgInvalido(i.cargaAnadidaEnInstalacionKg)) {
      falta("cargaAnadidaEnInstalacionKg", "En la instalaci\xF3n hay que anotar por separado la cantidad a\xF1adida in situ (0 si viene precargado).", "a");
    }
    const anadeGas = (i.kgAnadidos ?? 0) > 0;
    if (i.kgAnadidos !== void 0 && kgInvalido(i.kgAnadidos)) falta("kgAnadidos", "La cantidad a\xF1adida no es v\xE1lida.", "b");
    if (anadeGas) {
      if (vacio(i.gasAnadido)) falta("gasAnadido", "Se ha a\xF1adido gas: falta indicar qu\xE9 gas.", "d");
      if (!i.origenGasAnadido) falta("origenGasAnadido", "Se ha a\xF1adido gas: falta indicar si es virgen, reciclado o regenerado.", "d");
      if (i.origenGasAnadido === "reciclado" || i.origenGasAnadido === "regenerado") {
        const c = i.centroTratamiento;
        if (!c || vacio(c.nombre) || vacio(c.direccionUE)) {
          falta("centroTratamiento", `El gas es ${i.origenGasAnadido}: faltan el nombre y la direcci\xF3n en la UE del centro que lo trat\xF3.`, "d");
        } else if (vacio(c.numeroCertificado)) {
          avisos.push("Si el centro de reciclado o regeneraci\xF3n tiene n\xFAmero de certificado, debe anotarse (art. 7.1 d).");
        }
      }
      if (!vacio(i.gasAnadido) && !vacio(i.gasEquipo) && buscarRefrigerante(i.gasAnadido)?.id !== buscarRefrigerante(i.gasEquipo)?.id) {
        avisos.push(`El gas a\xF1adido (${i.gasAnadido}) no coincide con el del equipo (${i.gasEquipo}): si es un cambio de refrigerante, actualice la ficha y la etiqueta.`);
      }
    }
    if ((i.tipo === "recuperacion" || i.tipo === "desmantelamiento") && kgInvalido(i.kgRecuperados)) {
      falta("kgRecuperados", "En una recuperaci\xF3n o desmantelamiento hay que anotar la cantidad recuperada (kg).", "c");
    }
    const e = i.empresa;
    if (!e || vacio(e.nombre)) falta("empresa", "Falta identificar la empresa que realiza la intervenci\xF3n.", "e");
    else if (vacio(e.numeroCertificado)) falta("empresa.numeroCertificado", "Falta el n\xFAmero de certificado de la empresa (en Espa\xF1a es obligatorio estar habilitada: RD 115/2017, art. 3.8).", "e");
    if (e && e.esPersonaJuridica !== false) {
      if (!i.tecnico || vacio(i.tecnico.nombre)) falta("tecnico", "La empresa es persona jur\xEDdica: faltan los datos de la persona f\xEDsica que realiza la operaci\xF3n.", "e");
      else if (vacio(i.tecnico.numeroCertificado)) falta("tecnico.numeroCertificado", "Falta el n\xFAmero de certificado del t\xE9cnico que realiza la operaci\xF3n.", "e");
    }
    if ((i.tipo === "control_fugas" || i.tipo === "reparacion_fuga") && vacio(i.resultado)) {
      falta("resultado", i.tipo === "control_fugas" ? "Falta el resultado del control de fugas." : "Falta el resultado de la reparaci\xF3n de la fuga.", "f");
    }
    if (i.tipo === "desmantelamiento" && vacio(i.medidasRecuperacionEliminacion)) {
      falta("medidasRecuperacionEliminacion", "En el desmantelamiento hay que anotar las medidas para recuperar y eliminar el gas.", "g");
    }
    return { valida: faltan.length === 0, faltan, avisos };
  }
  function conservarRegistroHasta(fechaIntervencion) {
    return { fecha: sumarAnios(fechaIntervencion, 5), referencia: refFgas("art. 7, apdo. 2", "art_7") };
  }

  // cxobra/mantenimiento/normativa/src/rite.ts
  var TABLA_3_1 = [
    { fila: "Calentadores de agua caliente sanitaria a gas Pn \u2264 24,4 kW", aplica: (e, p) => e === "calentador_acs_gas" && p <= 24.4, vivienda: 60, otros: 24 },
    { fila: "Calentadores de agua caliente sanitaria a gas 24,4 kW < Pn \u2264 70 kW", aplica: (e, p) => e === "calentador_acs_gas" && p > 24.4 && p <= 70, vivienda: 24, otros: 12 },
    { fila: "Calderas murales a gas Pn \u2264 70 kW", aplica: (e, p) => e === "caldera_mural_gas" && p <= 70, vivienda: 24, otros: 12 },
    { fila: "Resto instalaciones calefacci\xF3n Pn \u2265 70 kW", aplica: (e, p) => e === "calefaccion_resto" && p >= 70, vivienda: 12, otros: 12 },
    { fila: "Aire acondicionado Pn \u2264 12 kW", aplica: (e, p) => e === "aire_acondicionado" && p <= 12, vivienda: 48, otros: 24 },
    { fila: "Aire acondicionado 12 kW < Pn \u2264 70 kW", aplica: (e, p) => e === "aire_acondicionado" && p > 12 && p <= 70, vivienda: 24, otros: 12 },
    { fila: "Bomba de calor para agua caliente sanitaria Pn \u2264 12 kW", aplica: (e, p) => e === "bomba_calor_acs" && p <= 12, vivienda: 48, otros: 24 },
    { fila: "Bomba de calor para agua caliente sanitaria 12 kW < Pn \u2264 70 kW", aplica: (e, p) => e === "bomba_calor_acs" && p > 12 && p <= 70, vivienda: 24, otros: 12 },
    { fila: "Instalaciones de potencia superior a 70 kW", aplica: (e, p) => e !== "solar_termica" && p > 70, vivienda: 1, otros: 1 },
    { fila: "Instalaciones solares t\xE9rmicas Pn \u2264 14 kW", aplica: (e, p) => e === "solar_termica" && p <= 14, vivienda: 12, otros: 12 },
    { fila: "Instalaciones solares t\xE9rmicas Pn > 14 kW", aplica: (e, p) => e === "solar_termica" && p > 14, vivienda: 6, otros: 6 }
  ];
  var REF_IT33 = refRite("IT 3.3, apdo. 1, tabla 3.1", "it3-2");
  function textoMeses(m) {
    if (m === 1) return "mensual";
    if (m === 6) return "semestral";
    if (m === 12) return "anual";
    if (m % 12 === 0) return `cada ${m / 12} a\xF1os`;
    return `cada ${m} meses`;
  }
  function periodicidadMantenimiento(c) {
    const pInst = c.potenciaInstalacionKw ?? c.potenciaKw;
    const filas = TABLA_3_1.filter(
      (f) => f.fila === "Instalaciones de potencia superior a 70 kW" ? f.aplica(c.equipo, pInst) : f.aplica(c.equipo, c.potenciaKw)
    );
    const tablaOperaciones = pInst > 70 ? "3.3" : "3.2";
    const refs = [REF_IT33, refRite(`IT 3.3, tabla ${tablaOperaciones}`, "it3-2")];
    if (filas.length === 0) {
      return {
        periodicidadMeses: null,
        filas: [],
        periodicidadMaximaConSupervisionMeses: null,
        tablaOperaciones,
        explicacion: "La tabla 3.1 no tiene fila para este equipo y potencia: manda el \xABManual de uso y mantenimiento\xBB y, si no existe, el criterio profesional de la empresa mantenedora (IT 3.3), teniendo en cuenta las especificaciones del fabricante.",
        referencias: refs
      };
    }
    const meses = Math.min(...filas.map((f) => c.uso === "vivienda" ? f.vivienda : f.otros));
    const conSupervision = pInst <= 70 && c.supervisionRemota ? Math.max(meses, 24) : null;
    let explicacion = `Mantenimiento preventivo ${textoMeses(meses)} como m\xEDnimo (tabla 3.1: ${filas.map((f) => f.fila).join("; ")}; ${c.uso === "vivienda" ? "viviendas" : "restantes usos"}).`;
    if (conSupervision !== null && conSupervision !== meses) explicacion += ` Con supervisi\xF3n remota en continuo puede ampliarse hasta ${textoMeses(conSupervision)} si se garantizan la seguridad y la eficiencia.`;
    explicacion += tablaOperaciones === "3.3" ? " Operaciones: tabla 3.3 (instalaciones de m\xE1s de 70 kW)." : " Operaciones: las del Manual de uso y mantenimiento; la tabla 3.2 es orientativa.";
    return { periodicidadMeses: meses, filas: filas.map((f) => f.fila), periodicidadMaximaConSupervisionMeses: conSupervision, tablaOperaciones, explicacion, referencias: refs };
  }
  function proximoMantenimiento(c, ultimo) {
    const r = periodicidadMantenimiento(c);
    return r.periodicidadMeses === null ? null : sumarMeses(ultimo, r.periodicidadMeses);
  }
  var TABLA_3_2 = {
    calefaccion_acs: [
      "Revisi\xF3n de aparatos exclusivos para la producci\xF3n de ACS: Pn \u2264 24,4 kW.",
      "Revisi\xF3n de aparatos exclusivos para la producci\xF3n de ACS: 24,4 kW < Pn \u2264 70 kW.",
      "Comprobaci\xF3n y limpieza, si procede, de circuito de humos de calderas.",
      "Comprobaci\xF3n y limpieza, si procede, de conductos de humos y chimenea.",
      "Limpieza, si procede, del quemador de la caldera.",
      "Revisi\xF3n del vaso de expansi\xF3n.",
      "Revisi\xF3n de los sistemas de tratamiento de agua.",
      "Comprobaci\xF3n de estanquidad de cierre entre quemador y caldera.",
      "Comprobaci\xF3n de niveles de agua en circuitos.",
      "Comprobaci\xF3n de tarado de elementos de seguridad.",
      "Revisi\xF3n y limpieza de filtros de agua.",
      "Revisi\xF3n del sistema de preparaci\xF3n de agua caliente sanitaria (limpieza de dep\xF3sitos, purga, etc.).",
      "Revisi\xF3n del estado del aislamiento t\xE9rmico, especialmente en las instalaciones ubicadas a la intemperie.",
      "Revisi\xF3n del sistema de control autom\xE1tico.",
      "Revisi\xF3n del estado de los captadores solares (limpieza, estado de cristales, juntas, absorbedor, carcasa y conexiones) y estructura y apoyos.",
      "Adopci\xF3n de medidas contra sobrecalentamiento (tapado, vaciado de captadores, etc.).",
      "Purgado del campo de captaci\xF3n",
      "Verificaci\xF3n del estado de la mezcla anticongelante (PH, grado de protecci\xF3n antihelada, etc.) y actuaci\xF3n del sistema de llenado.",
      "Revisi\xF3n del estado del sistema de intercambio (limpieza, etc.)",
      "En caso de tratarse de un calentador atmosf\xE9rico, comprobar que se cumplen los requisitos de ventilaci\xF3n exigidos en la norma UNE 60670-6:2014."
    ],
    climatizacion: [
      "Limpieza de los evaporadores. Limpieza de los condensadores.",
      "Drenaje, limpieza y tratamiento del circuito de torres de refrigeraci\xF3n.",
      "Comprobaci\xF3n de la estanquidad y niveles de refrigerante y aceite en equipos frigor\xEDficos.",
      "Revisi\xF3n y limpieza de filtros de aire.",
      "Revisi\xF3n de aparatos de humectaci\xF3n y enfriamiento evaporativo.",
      "Revisi\xF3n y limpieza de aparatos de recuperaci\xF3n de calor.",
      "Revisi\xF3n de unidades terminales agua-aire.",
      "Revisi\xF3n de unidades terminales de distribuci\xF3n de aire.",
      "Revisi\xF3n y limpieza de unidades de impulsi\xF3n y retorno de aire.",
      "Revisi\xF3n de equipos aut\xF3nomos."
    ]
  };
  var TABLA_3_3 = [
    { numero: 1, operacion: "Limpieza de los evaporadores", periodicidad: "t", ambito: "climatizacion" },
    { numero: 2, operacion: "Limpieza de los condensadores", periodicidad: "t", ambito: "climatizacion" },
    { numero: 3, operacion: "Drenaje, limpieza y tratamiento del circuito de torres de refrigeraci\xF3n", periodicidad: "2t", ambito: "climatizacion" },
    { numero: 4, operacion: "Comprobaci\xF3n de la estanquidad y niveles de refrigerante y aceite en equipos frigor\xEDficos", periodicidad: "m", ambito: "climatizacion" },
    { numero: 5, operacion: "Comprobaci\xF3n y limpieza, si procede, de circuito de humos de calderas", periodicidad: "2t", ambito: "calefaccion_acs" },
    { numero: 6, operacion: "Comprobaci\xF3n y limpieza, si procede, de conductos de humos y chimenea", periodicidad: "2t", ambito: "calefaccion_acs" },
    { numero: 7, operacion: "Limpieza del quemador de la caldera", periodicidad: "m", ambito: "calefaccion_acs" },
    { numero: 8, operacion: "Revisi\xF3n del vaso de expansi\xF3n", periodicidad: "m", ambito: "general" },
    { numero: 9, operacion: "Revisi\xF3n de los sistemas de tratamiento de agua", periodicidad: "m", ambito: "general" },
    { numero: 10, operacion: "Comprobaci\xF3n de material refractario", periodicidad: "2t", ambito: "calefaccion_acs" },
    { numero: 11, operacion: "Comprobaci\xF3n de estanquidad de cierre entre quemador y caldera", periodicidad: "m", ambito: "calefaccion_acs" },
    { numero: 12, operacion: "Revisi\xF3n general de calderas de gas", periodicidad: "t", ambito: "calefaccion_acs" },
    { numero: 13, operacion: "Revisi\xF3n general de calderas de gas\xF3leo", periodicidad: "t", ambito: "calefaccion_acs" },
    { numero: 14, operacion: "Comprobaci\xF3n de niveles de agua en circuitos", periodicidad: "m", ambito: "general" },
    { numero: 15, operacion: "Comprobaci\xF3n de estanquidad de circuitos de tuber\xEDas", periodicidad: "t", ambito: "general" },
    { numero: 16, operacion: "Comprobaci\xF3n de estanquidad de v\xE1lvulas de interceptaci\xF3n", periodicidad: "2t", ambito: "general" },
    { numero: 17, operacion: "Comprobaci\xF3n de tarado de elementos de seguridad", periodicidad: "m", ambito: "general" },
    { numero: 18, operacion: "Revisi\xF3n y limpieza de filtros de agua", periodicidad: "2t", ambito: "general" },
    { numero: 19, operacion: "Revisi\xF3n y limpieza de filtros de aire", periodicidad: "m", ambito: "climatizacion" },
    { numero: 20, operacion: "Revisi\xF3n de bater\xEDas de intercambio t\xE9rmico", periodicidad: "t", ambito: "climatizacion" },
    { numero: 21, operacion: "Revisi\xF3n de aparatos de humectaci\xF3n y enfriamiento evaporativo", periodicidad: "m", ambito: "climatizacion" },
    { numero: 22, operacion: "Revisi\xF3n y limpieza de aparatos de recuperaci\xF3n de calor", periodicidad: "2t", ambito: "climatizacion" },
    { numero: 23, operacion: "Revisi\xF3n de unidades terminales agua-aire", periodicidad: "2t", ambito: "climatizacion" },
    { numero: 24, operacion: "Revisi\xF3n de unidades terminales de distribuci\xF3n de aire", periodicidad: "2t", ambito: "climatizacion" },
    { numero: 25, operacion: "Revisi\xF3n y limpieza de unidades de impulsi\xF3n y retorno de aire", periodicidad: "t", ambito: "climatizacion" },
    { numero: 26, operacion: "Revisi\xF3n de equipos aut\xF3nomos", periodicidad: "2t", ambito: "climatizacion" },
    { numero: 27, operacion: "Revisi\xF3n de bombas y ventiladores", periodicidad: "m", ambito: "general" },
    { numero: 28, operacion: "Revisi\xF3n del sistema de preparaci\xF3n de agua caliente sanitaria", periodicidad: "m", ambito: "calefaccion_acs" },
    { numero: 29, operacion: "Revisi\xF3n del estado del aislamiento t\xE9rmico, especialmente en las instalaciones ubicadas a la intemperie", periodicidad: "t", ambito: "general" },
    { numero: 30, operacion: "Revisi\xF3n del sistema de control autom\xE1tico", periodicidad: "2t", ambito: "general" },
    { numero: 31, operacion: "Comprobaci\xF3n del estado de almacenamiento del biocombustible s\xF3lido", periodicidad: "S*", ambito: "biomasa" },
    { numero: 32, operacion: "Apertura y cierre del contenedor plegable en instalaciones de biocombustible s\xF3lido", periodicidad: "2t", ambito: "biomasa" },
    { numero: 33, operacion: "Limpieza y retirada de cenizas en instalaciones de biocombustible s\xF3lido", periodicidad: "m", ambito: "biomasa" },
    { numero: 34, operacion: "Control visual de la caldera de biomasa", periodicidad: "S*", ambito: "biomasa" },
    { numero: 35, operacion: "Comprobaci\xF3n y limpieza, si procede, de circuito de humos de calderas y conductos de humos y chimeneas en calderas de biomasa", periodicidad: "m", ambito: "biomasa" },
    { numero: 36, operacion: "Revisi\xF3n de los elementos de seguridad en instalaciones de biomasa", periodicidad: "m", ambito: "biomasa" },
    { numero: 37, operacion: "Revisi\xF3n de la red de conductos seg\xFAn criterio de la norma UNE 100012", periodicidad: "t", ambito: "climatizacion" },
    { numero: 38, operacion: "Revisi\xF3n de la calidad ambiental seg\xFAn criterios de la norma UNE 171330", periodicidad: "t", ambito: "climatizacion" },
    { numero: 39, operacion: "Revisi\xF3n del estado de los captadores solares (limpieza, estado de cristales, juntas, absorbedor, carcasa y conexiones) y estructura y apoyos", periodicidad: "2t y S*", ambito: "solar" },
    { numero: 40, operacion: "Adopci\xF3n de medidas contra sobrecalentamiento (tapado, vaciado de captadores, etc.)", periodicidad: "2t", ambito: "solar" },
    { numero: 41, operacion: "Purgado del campo de captaci\xF3n", periodicidad: "2t", ambito: "solar" },
    { numero: 42, operacion: "Verificaci\xF3n del estado de la mezcla anticongelante (PH, grado de protecci\xF3n antihelada, etc.). y actuaci\xF3n del sistema de llenado", periodicidad: "t", ambito: "solar" },
    { numero: 43, operacion: "Revisi\xF3n del estado del sistema de intercambio (limpieza, etc.)", periodicidad: "t", ambito: "solar" }
  ];
  var LEYENDA_TABLA_3_3 = {
    S: "Una vez cada semana.",
    "S*": "Estas operaciones podr\xE1n realizarse por el propio usuario, con el asesoramiento previo del mantenedor.",
    m: "Una vez al mes; la primera al inicio de la temporada.",
    t: "Una vez por temporada (a\xF1o).",
    "2t": "Dos veces por temporada (a\xF1o); una al inicio de la misma y otra a la mitad del per\xEDodo de uso, siempre que haya una diferencia m\xEDnima de dos meses entre ambas."
  };
  function operacionesTabla33(ambitos) {
    return TABLA_3_3.filter((o) => ambitos.includes(o.ambito));
  }
  var MEDIDAS_GENERADORES_CALOR = [
    "Temperatura o presi\xF3n del fluido portador en entrada y salida del generador de calor",
    "Temperatura ambiente del local o sala de m\xE1quinas",
    "Temperatura de los gases de combusti\xF3n",
    "Contenido de CO y CO2 en los productos de combusti\xF3n",
    "\xCDndice de opacidad de los humos en combustibles s\xF3lidos o l\xEDquidos y de contenido de part\xEDculas s\xF3lidas en combustibles s\xF3lidos",
    "Tiro en la caja de humos de la caldera"
  ];
  var MEDIDAS_GENERADORES_FRIO = [
    "Temperatura del fluido exterior en entrada y salida del evaporador.",
    "Temperatura del fluido exterior en entrada y salida del condensador.",
    "P\xE9rdida de presi\xF3n en el evaporador en plantas enfriadas por agua.",
    "P\xE9rdida de presi\xF3n en el condensador en plantas enfriadas por agua.",
    "Temperatura y presi\xF3n de evaporaci\xF3n.",
    "Temperatura y presi\xF3n de condensaci\xF3n.",
    "Potencia el\xE9ctrica absorbida.",
    "Potencia t\xE9rmica instant\xE1nea del generador, como porcentaje de la carga m\xE1xima.",
    "EER instant\xE1neo.",
    "Caudal de agua en el evaporador.",
    "Caudal de agua en el condensador."
  ];
  function medidasGeneradorCalor(potenciaKw) {
    const referencia = refRite("IT 3.4.1 (tabla \xABMedidas de generadores de calor y su periodicidad\xBB)", "it3-2");
    if (potenciaKw <= 20) return { periodicidadMeses: null, codigo: null, medidas: [], explicacion: "Hasta 20 kW la IT 3.4.1 no fija medidas peri\xF3dicas del generador de calor.", referencia };
    const [codigo, meses] = potenciaKw <= 70 ? ["2a", 24] : potenciaKw <= 1e3 ? ["3m", 3] : ["m", 1];
    return { periodicidadMeses: meses, codigo, medidas: MEDIDAS_GENERADORES_CALOR, explicacion: `Medidas de rendimiento del generador de calor ${textoMeses(meses)}.`, referencia };
  }
  function medidasGeneradorFrio(potenciaKw) {
    const referencia = refRite("IT 3.4.2 (tabla \xABMedidas de generadores de fr\xEDo y su periodicidad\xBB)", "it3-2");
    if (potenciaKw <= 70) return { periodicidadMeses: null, codigo: null, medidas: [], explicacion: "Hasta 70 kW la IT 3.4.2 no fija medidas peri\xF3dicas del generador de fr\xEDo.", referencia };
    const [codigo, meses] = potenciaKw <= 1e3 ? ["3m", 3] : ["m", 1];
    return { periodicidadMeses: meses, codigo, medidas: MEDIDAS_GENERADORES_FRIO, explicacion: `Medidas de rendimiento del generador de fr\xEDo ${textoMeses(meses)}.`, referencia };
  }
  function regimenMantenimiento(i) {
    const p = Math.max(i.potenciaCalorKw, i.potenciaFrioKw);
    const ref26 = refRite("art. 26, apdo. 6", "a26");
    const ref28 = refRite("art. 28, apdo. 1", "a28");
    if (i.potenciaCalorKw > 5e3 || i.potenciaFrioKw > 1e3 || (i.potenciaSolarKw ?? 0) > 400) {
      return {
        caso: "c",
        empresaMantenedora: true,
        contratoMantenimiento: true,
        directorMantenimiento: true,
        certificadoAnual: true,
        explicacion: "M\xE1s de 5 000 kW en calor, m\xE1s de 1 000 kW en fr\xEDo o m\xE1s de 400 kW solares: contrato con empresa mantenedora, mantenimiento dirigido por un t\xE9cnico titulado (director de mantenimiento) y certificado de mantenimiento anual firmado por ambos.",
        referencias: [refRite("art. 26, apdo. 6, letra c)", "a26"), ref28]
      };
    }
    if (p > 70) {
      return {
        caso: "b",
        empresaMantenedora: true,
        contratoMantenimiento: true,
        directorMantenimiento: false,
        certificadoAnual: true,
        explicacion: "M\xE1s de 70 kW: el titular debe tener contrato con una empresa mantenedora habilitada, que emite cada a\xF1o el certificado de mantenimiento (v\xE1lido como m\xE1ximo un a\xF1o).",
        referencias: [refRite("art. 26, apdo. 6, letra b)", "a26"), ref28]
      };
    }
    if (p >= 5) {
      return {
        caso: "a",
        empresaMantenedora: true,
        contratoMantenimiento: false,
        directorMantenimiento: false,
        certificadoAnual: false,
        explicacion: "Entre 5 y 70 kW: mantenimiento por empresa mantenedora habilitada seg\xFAn el Manual de uso y mantenimiento. El RITE no exige contrato ni certificado anual (algunas comunidades aut\xF3nomas s\xED; no modelado).",
        referencias: [refRite("art. 26, apdo. 6, letra a)", "a26"), ref28]
      };
    }
    return {
      caso: "fuera_art_26_6",
      empresaMantenedora: false,
      contratoMantenimiento: false,
      directorMantenimiento: false,
      certificadoAnual: false,
      explicacion: "Menos de 5 kW: fuera de los casos del art. 26.6 (sin obligaci\xF3n de empresa mantenedora ni certificado). Se aplican igualmente las periodicidades de la tabla 3.1 y las del fabricante.",
      referencias: [ref26]
    };
  }
  var CONTENIDO_CERTIFICADO_MANTENIMIENTO = [
    { letra: "a", texto: "Identificaci\xF3n de la instalaci\xF3n, incluyendo el n\xFAmero de expediente inicial con el que se registr\xF3 la instalaci\xF3n." },
    { letra: "b", texto: "Identificaci\xF3n de la empresa mantenedora, mantenedor habilitado responsable de la instalaci\xF3n y del director de mantenimiento, cuando la participaci\xF3n de este \xFAltimo sea preceptiva." },
    { letra: "c", texto: "Declaraci\xF3n expresa de que la instalaci\xF3n ha sido mantenida de acuerdo con el Manual de Uso y Mantenimiento y que cumple con los requisitos exigidos en la IT 3." },
    { letra: "d", texto: "Resumen de los consumos anuales registrados: combustible, energ\xEDa el\xE9ctrica, agua para llenado de las instalaciones, agua caliente sanitaria, totalizaci\xF3n de los contadores individuales de agua caliente sanitaria y energ\xEDa t\xE9rmica." },
    { letra: "e", texto: "Resumen de las aportaciones anuales: t\xE9rmicas de la central de producci\xF3n y de las energ\xEDas renovables y/o cogeneraci\xF3n si las hubiese." }
  ];
  function vencimientoCertificadoMantenimiento(fechaEmision) {
    return { fecha: sumarAnios(fechaEmision, 1), referencia: refRite("art. 28, apdo. 1", "a28") };
  }
  function conservarRegistroMantenimientoHasta(fechaOperacion) {
    return { fecha: sumarAnios(fechaOperacion, 5), referencia: refRite("art. 27, apdo. 2", "a27") };
  }
  function inspeccionesEficiencia(c, hoy) {
    const sistemas = [];
    const refs = [];
    const frioSujeto = c.potenciaFrioKw > 70;
    const calorSujeto = c.potenciaCalorKw > 70 && !(c.soloACS && c.potenciaCalorKw <= 70);
    if (c.generadorComunFrioCalor) {
      if (frioSujeto || calorSujeto) {
        sistemas.push("aire_acondicionado");
        refs.push(refRite("IT 4.2.1, apdo. 4, \xFAltimo p\xE1rrafo (bomba de calor \u2192 IT 4.2.2)", "it4-2"), refRite("IT 4.2.2, apdo. 1", "it4-2"), refRite("IT 4.3.2", "it4-2"));
      }
    } else {
      if (calorSujeto) {
        sistemas.push("calefaccion_acs");
        refs.push(refRite("IT 4.2.1, apdo. 1", "it4-2"), refRite("IT 4.3.1", "it4-2"));
      }
      if (frioSujeto) {
        sistemas.push("aire_acondicionado");
        refs.push(refRite("IT 4.2.2, apdo. 1", "it4-2"), refRite("IT 4.3.2", "it4-2"));
      }
    }
    const cumple15Anios = sumarAnios(c.fechaPrimerCertificado, 15);
    const potenciaTotal = Math.max(c.potenciaCalorKw, c.potenciaFrioKw);
    if (c.exentaIT434) {
      return {
        obligatoria: false,
        sistemas: [],
        cadaAnios: null,
        proxima: null,
        proximaEsSupuesto: false,
        completaObligatoria: false,
        cumple15Anios,
        proximaCompleta: null,
        explicacion: "Exenta de las inspecciones IT 4.2.1, 4.2.2 y 4.2.3 por contrato de rendimiento energ\xE9tico o sistema de automatizaci\xF3n y control conforme a la IT 1.2.4.3.5.",
        referencias: [refRite("IT 4.3.4", "it4-2")]
      };
    }
    if (sistemas.length === 0) {
      return {
        obligatoria: false,
        sistemas,
        cadaAnios: null,
        proxima: null,
        proximaEsSupuesto: false,
        completaObligatoria: false,
        cumple15Anios,
        proximaCompleta: null,
        explicacion: "Generaci\xF3n de calor y de fr\xEDo de 70 kW o menos: sin inspecci\xF3n peri\xF3dica de eficiencia energ\xE9tica del RITE.",
        referencias: [refRite("IT 4.2.1, apdo. 1", "it4-2"), refRite("IT 4.2.2, apdo. 1", "it4-2")]
      };
    }
    const proximaEsSupuesto = !c.ultimaInspeccion;
    const proxima = sumarAnios(c.ultimaInspeccion ?? c.fechaPrimerCertificado, 4);
    const completaObligatoria = potenciaTotal > 70 && desde(hoy, cumple15Anios);
    let proximaCompleta = null;
    if (potenciaTotal > 70) {
      if (c.ultimaInspeccionCompleta) proximaCompleta = sumarAnios(c.ultimaInspeccionCompleta, 15);
      else {
        let f = proxima;
        while (esAnterior(f, cumple15Anios)) f = sumarAnios(f, 4);
        proximaCompleta = f;
      }
      refs.push(refRite("IT 4.2.3", "it4-2"), refRite("IT 4.3.3", "it4-2"));
    }
    const vencida = esAnterior(proxima, hoy);
    let explicacion = `Inspecci\xF3n peri\xF3dica de eficiencia energ\xE9tica cada 4 a\xF1os (${sistemas.map((s) => s === "aire_acondicionado" ? "aire acondicionado" : "calefacci\xF3n y ACS").join(" y ")}). `;
    explicacion += vencida ? `Venci\xF3 el ${fechaLarga(proxima)}.` : `Pr\xF3xima como tarde el ${fechaLarga(proxima)}${proximaEsSupuesto ? " (supuesto: no consta inspecci\xF3n previa y se cuenta desde el primer certificado)" : ""}.`;
    if (proximaCompleta) {
      explicacion += completaObligatoria ? ` La instalaci\xF3n ya tiene m\xE1s de 15 a\xF1os: la inspecci\xF3n de la instalaci\xF3n completa toca el ${fechaLarga(proximaCompleta)}.` : ` Cumple 15 a\xF1os el ${fechaLarga(cumple15Anios)}; la inspecci\xF3n de la instalaci\xF3n completa coincidir\xE1 con la inspecci\xF3n del ${fechaLarga(proximaCompleta)}.`;
    }
    return { obligatoria: true, sistemas, cadaAnios: 4, proxima, proximaEsSupuesto, completaObligatoria, cumple15Anios, proximaCompleta, explicacion, referencias: refs };
  }
  var FUENTE_TABLAS_IT3 = { consolidado: URL2.rite, original: URL2.riteOriginal };

  // cxobra/mantenimiento/normativa/src/tecnicos.ts
  var LIMITE_PRIMERA_ACTUALIZACION = "2029-03-12";
  var REF_10_9 = refFgas("art. 10, apdo. 9", "art_10");
  function estadoCertificado(c, fecha, avisoDias = 180) {
    let fechaLimite;
    let base2;
    if (c.fechaUltimaActualizacion) {
      fechaLimite = sumarAnios(c.fechaUltimaActualizacion, 7);
      base2 = `\xFAltima actualizaci\xF3n el ${fechaLarga(c.fechaUltimaActualizacion)} + 7 a\xF1os`;
    } else if (c.marco === "antiguo") {
      fechaLimite = LIMITE_PRIMERA_ACTUALIZACION;
      base2 = "certificado anterior al Reglamento 2024/573: primera actualizaci\xF3n a m\xE1s tardar el 12 de marzo de 2029";
    } else {
      fechaLimite = sumarAnios(c.fechaExpedicion, 7);
      base2 = `expedido el ${fechaLarga(c.fechaExpedicion)} + 7 a\xF1os`;
    }
    const diasRestantes = diasEntre(fecha, fechaLimite);
    const vigente = diasRestantes >= 0;
    const porVencer = vigente && diasRestantes <= avisoDias;
    const explicacion = vigente ? `Certificado en regla. Debe actualizarse (formaci\xF3n o evaluaci\xF3n) como tarde el ${fechaLarga(fechaLimite)} (${base2}).` : `Actualizaci\xF3n vencida desde el ${fechaLarga(sumarDias(fechaLimite, 1))} (${base2}). Seg\xFAn el borrador del nuevo RD, el certificado no renovado queda suspendido hasta que se acredite la renovaci\xF3n: el t\xE9cnico no deber\xEDa intervenir hasta actualizarlo.`;
    return { vigente, fechaLimite, diasRestantes, porVencer, explicacion, referencias: [REF_10_9] };
  }
  function puedeRealizar(c, actividad, cargaKg, fecha) {
    const estado = estadoCertificado(c, fecha);
    const refs = [refRd115(c.categoria === "RD115_I1_cualquier_carga" ? "art. 3, apdo. 1; anexo I.1" : "art. 3, apdo. 2; anexo I.2", "a3"), refRd115("art. 3, apdo. 8", "a3")];
    if (!estado.vigente) return { puede: false, explicacion: estado.explicacion, referencias: [...refs, ...estado.referencias] };
    if (c.categoria === "RD115_I1_cualquier_carga") {
      return { puede: true, explicacion: "El certificado de cualquier carga habilita para esta actividad (siempre dentro de una empresa habilitada).", referencias: refs };
    }
    if (actividad === "control_fugas") {
      return { puede: true, explicacion: "El certificado de menos de 3 kg permite tambi\xE9n el control de fugas en equipos de cualquier carga.", referencias: refs };
    }
    if (cargaKg < 3) {
      return { puede: true, explicacion: `El equipo tiene ${numeroES(cargaKg)} kg (< 3 kg): el certificado de menos de 3 kg habilita.`, referencias: refs };
    }
    return { puede: false, explicacion: `El equipo tiene ${numeroES(cargaKg)} kg: con 3 kg o m\xE1s hace falta el certificado de cualquier carga (anexo I.1).`, referencias: refs };
  }
  function certificadoEnRegla(c, fecha) {
    return desde(estadoCertificado(c, fecha).fechaLimite, fecha);
  }

  // cxobra/mantenimiento/fuente/logica/formato.ts
  var formato_exports = {};
  __export(formato_exports, {
    fechaCorta: () => fechaCorta,
    fechaLarga: () => fechaLarga2,
    hora: () => hora,
    hoyISO: () => hoyISO,
    kg: () => kg,
    leerCantidad: () => leerCantidad,
    numero: () => numero,
    pcaTexto: () => pcaTexto,
    pulsarTecla: () => pulsarTecla,
    sinCortar: () => sinCortar,
    sumarRapido: () => sumarRapido,
    tco2eTexto: () => tco2eTexto
  });
  function hoyISO(d = /* @__PURE__ */ new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function fechaLarga2(iso, meses) {
    const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
    return `${String(d).padStart(2, "0")}-${meses[m - 1]}-${a}`;
  }
  function fechaCorta(iso, meses, hoy) {
    const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
    return a === Number(hoy.slice(0, 4)) ? `${d} ${meses[m - 1]}` : fechaLarga2(iso, meses);
  }
  function sinCortar(texto2) {
    return texto2.replace(/(\S)-(?=\S)/g, "$1\u2011");
  }
  function hora(iso) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function kg(n, decimalComa = ",") {
    const dec = n < 3 && Math.round(n * 100) % 10 !== 0 ? 2 : 1;
    return n.toFixed(dec).replace(".", decimalComa);
  }
  function numero(n, decimales, decimalComa = ",") {
    return n.toFixed(decimales).replace(".", decimalComa);
  }
  function leerCantidad(texto2) {
    const n = Number(texto2.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  function pulsarTecla(actual, tecla) {
    if (tecla === "\u232B") return actual.slice(0, -1);
    if (tecla === ",") return actual.includes(",") ? actual : `${actual || "0"},`;
    if (actual.length >= 6) return actual;
    if (actual.includes(",") && actual.split(",")[1].length >= 2) return actual;
    if (actual === "0") return tecla;
    return actual + tecla;
  }
  function sumarRapido(actual, suma) {
    const x = Math.round((leerCantidad(actual) + suma) * 100) / 100;
    return String(x).replace(".", ",");
  }
  function tco2eTexto(t) {
    const r = Math.round(Number((t * 100).toFixed(6))) / 100;
    const umbral = [5, 50, 500].find((u) => r === u && t < u);
    const v = umbral !== void 0 ? Math.floor(Number((t * 100).toFixed(6))) / 100 : r;
    return v.toFixed(2).replace(".", ",");
  }
  function pcaTexto(pca) {
    return String(Math.round(pca));
  }

  // cxobra/mantenimiento/fuente/logica/reglas.ts
  var TIPOS_REFRIGERACION = /* @__PURE__ */ new Set(["camara_frigorifica", "central_frigorifica", "mueble_frigorifico"]);
  function usoArt13(tipo) {
    return TIPOS_REFRIGERACION.has(tipo) ? "refrigeracion" : "climatizacion";
  }
  function comoEquipoFijo(eq, gas) {
    return {
      gas,
      cargaKg: Number(eq.carga_kg ?? 0),
      funcion: TIPOS_REFRIGERACION.has(eq.tipo) ? "refrigeracion" : eq.tipo.startsWith("bomba_calor") ? "bomba_calor" : "aire_acondicionado",
      sistemaDeteccionFugas: Boolean(eq.deteccion_fugas),
      selladoHermeticoEtiquetado: Boolean(eq.hermetico),
      enEdificioResidencial: Boolean(eq.en_vivienda)
    };
  }
  function comoEquipoRecarga(eq) {
    return { uso: usoArt13(eq.tipo), cargaKg: Number(eq.carga_kg ?? 0), esEnfriadora: eq.tipo === "enfriadora" };
  }
  function gasDe(eq) {
    if (!eq.refrigerante || !eq.carga_kg) return null;
    return buscarRefrigerante(eq.refrigerante) ?? null;
  }
  function fichaGas(eq, ultimoControl2, hoy) {
    const gas = gasDe(eq);
    if (!gas) return null;
    const fijo = comoEquipoFijo(eq, gas);
    const t = tco2e(fijo.cargaKg, gas);
    return {
      gas,
      kg: fijo.cargaKg,
      toneladas: t,
      toneladasTexto: tco2eTexto(t),
      control: controlFugas(fijo),
      proximo: proximoControlFugas(fijo, ultimoControl2, hoy),
      virgen: puedeRecargar(comoEquipoRecarga(eq), gas, "virgen", hoy),
      uso: usoArt13(eq.tipo)
    };
  }
  function comprobarCilindro(eq, c, hoy) {
    const gas = gasDe(eq);
    const delCilindro = buscarRefrigerante(c.refrigerante);
    if (!gas || !delCilindro || delCilindro.id !== gas.id) return { estado: "otro_gas" };
    const opciones = c.origen === "reciclado" && c.reciclado_por_mi_empresa !== null ? { recicladoPorLaMismaEmpresa: Boolean(c.reciclado_por_mi_empresa) } : {};
    const resultado = puedeRecargar(comoEquipoRecarga(eq), gas, c.origen ?? "virgen", hoy, opciones);
    if (!resultado.permitido) return { estado: "prohibido", resultado };
    if (c.kg <= 0) return { estado: "vacio" };
    return { estado: "permitido", resultado };
  }
  function cilindrosParaCargar(eq, cilindros2, hoy) {
    const mismos = cilindros2.filter((c) => c.uso === "carga" && comprobarCilindro(eq, c, hoy).estado !== "otro_gas");
    const permitidos = mismos.filter((c) => comprobarCilindro(eq, c, hoy).estado === "permitido").sort((a, b) => rangoOrigen(a) - rangoOrigen(b) || b.kg - a.kg);
    const prohibidos = mismos.filter((c) => comprobarCilindro(eq, c, hoy).estado !== "permitido");
    return { permitidos, prohibidos };
  }
  function rangoOrigen(c) {
    return c.origen === "regenerado" ? 0 : c.origen === "reciclado" ? 1 : 2;
  }
  function alternativaLegal(eq, cilindros2, hoy) {
    return cilindrosParaCargar(eq, cilindros2, hoy).permitidos[0] ?? null;
  }
  function cilindroDeRecuperacion(eq, cilindros2) {
    const gas = gasDe(eq);
    if (!gas) return null;
    return cilindros2.filter((c) => c.uso === "recuperacion" && buscarRefrigerante(c.refrigerante)?.id === gas.id).sort((a, b) => Number(b.capacidad_kg ?? 0) - b.kg - (Number(a.capacidad_kg ?? 0) - a.kg))[0] ?? null;
  }
  function trasReparar(eq, fecha) {
    const gas = gasDe(eq);
    return gas ? comprobacionTrasReparacion(comoEquipoFijo(eq, gas), fecha) : null;
  }
  function porcentajeDeCarga(eq, kg2) {
    const c = Number(eq.carga_kg ?? 0);
    return c > 0 ? kg2 / c * 100 : 0;
  }
  function habilitacion(certs, actividad, cargaKg, hoy) {
    const fgas = certs.filter((c) => c.esquema === "fgas").sort((a, b) => (b.caduca_el ?? "9999").localeCompare(a.caduca_el ?? "9999"));
    const vigentes = fgas.filter((c) => (!c.caduca_el || c.caduca_el >= hoy) && (!c.expedido_el || c.expedido_el <= hoy));
    if (!vigentes.length) {
      const c = fgas[0] ?? null;
      return {
        puede: false,
        certificado: c,
        diasParaCaducar: c?.caduca_el ? diasEntre(hoy, c.caduca_el) : null,
        explicacion: c ? `Tu certificado de gases fluorados (${c.numero}) caduc\xF3 el ${c.caduca_el}. Sin certificado vigente no puedes intervenir en equipos con gas fluorado.` : "No consta tu certificado de gases fluorados. Sin \xE9l no puedes intervenir en equipos con gas fluorado."
      };
    }
    let mejor = null;
    for (const c of vigentes) {
      const menos3 = !/cualquier/i.test(c.categoria) && /I\.?2(?![0-9])|(^|[^0-9/.])2(?![0-9])|menos|<\s*3/i.test(c.categoria);
      const categoria = menos3 ? "RD115_I2_menos_3kg" : "RD115_I1_cualquier_carga";
      const r = puedeRealizar({ categoria, marco: "nuevo", fechaExpedicion: hoy }, actividad, cargaKg, hoy);
      const h = { puede: r.puede, explicacion: r.explicacion, certificado: c, diasParaCaducar: c.caduca_el ? diasEntre(hoy, c.caduca_el) : null };
      if (r.puede) return h;
      mejor ??= h;
    }
    return mejor;
  }
  var OPERACIONES_POR_TIPO = {
    enfriadora: [1, 2, 4, 27, 30],
    bomba_calor_aire_agua: [1, 2, 4, 27, 30],
    vrf: [4, 19, 20, 30],
    multisplit: [4, 19, 26],
    split: [19, 26],
    compacto: [19, 26],
    bomba_calor_aire_aire: [19, 26],
    rooftop: [4, 19, 20, 25, 26],
    camara_frigorifica: [1, 2, 4, 29],
    central_frigorifica: [1, 2, 4, 17, 29],
    mueble_frigorifico: [1, 2, 4],
    unidad_tratamiento_aire: [19, 20, 22, 25],
    fancoil: [19, 23],
    recuperador: [19, 22],
    ventilador: [27],
    extractor: [27],
    bomba: [27],
    caldera: [5, 7, 11, 12]
  };
  var MESES_CODIGO = { m: 1, "2t": 6, t: 12 };
  function tabla31(tipo) {
    if (tipo === "caldera") return "calefaccion_resto";
    return "aire_acondicionado";
  }
  function operacionesIt3(eq, potenciaInstalacionKw, usoEdificio, ultimas, hoy) {
    const potencia = Math.max(Number(eq.potencia_frio_kw ?? 0), Number(eq.potencia_calor_kw ?? 0));
    const consulta = {
      equipo: tabla31(eq.tipo),
      potenciaKw: potencia || 1,
      potenciaInstalacionKw: potenciaInstalacionKw ?? (potencia || 1),
      uso: usoEdificio === "vivienda" ? "vivienda" : "otros"
    };
    const p = periodicidadMantenimiento(consulta);
    const numeros = OPERACIONES_POR_TIPO[eq.tipo] ?? [];
    const ops = TABLA_3_3.filter((o) => numeros.includes(o.numero) && o.periodicidad !== "S*");
    const todas = ops.map((o) => {
      const codigo = `rite.it3.t33.${o.numero}`;
      const meses = p.tablaOperaciones === "3.3" ? MESES_CODIGO[o.periodicidad.split(" ")[0]] ?? 12 : p.periodicidadMeses ?? 12;
      return {
        codigo,
        numero: o.numero,
        texto: o.operacion,
        meses,
        periodicidad: p.tablaOperaciones === "3.3" ? o.periodicidad : `${meses}m`,
        ultima: ultimas.get(codigo) ?? null
      };
    });
    const hoyToca = todas.filter((o) => !o.ultima || sumarMeses(o.ultima.slice(0, 10), o.meses) <= hoy);
    return { hoy: hoyToca, todas, tabla: p.tablaOperaciones, mesesMinimo: p.periodicidadMeses };
  }
  function citas(r) {
    return r.referencias.map(citar).join(" \xB7 ");
  }

  // cxobra/mantenimiento/fuente/logica/mantenimiento.ts
  async function rutaDeHoy(ctx) {
    const ordenes = await ctx.base.todas(
      `select o.id, o.edificio_id, o.contrato_id, o.descripcion, o.estado, e.nombre, e.municipio
       from ordenes_trabajo o join edificios e on e.id = o.edificio_id
      where o.tecnico_id = ? and o.fecha_prevista = ? and o.estado <> 'cancelada' and o.borrado_en is null
      order by o.rowid`,
      [ctx.usuarioId, ctx.hoy]
    );
    const r = [];
    for (const o of ordenes) {
      const eqs = await equiposDelEdificio(ctx.base, o.edificio_id);
      const v = await ctx.base.una("select id, estado from visitas where edificio_id = ? and fecha = ?", [o.edificio_id ?? null, ctx.hoy]);
      const hechos = v ? Number((await ctx.base.una("select count(*) as n from visita_equipos where visita_id = ? and terminado = 1", [v.id]))?.n ?? 0) : 0;
      r.push({
        ordenId: o.id,
        edificioId: o.edificio_id,
        contratoId: o.contrato_id,
        nombre: o.nombre,
        municipio: o.municipio,
        descripcion: o.descripcion,
        estadoOrden: o.estado,
        equipos: eqs.length,
        hechos,
        visitaCerrada: v?.estado === "cerrada"
      });
    }
    return r;
  }
  async function visita(ctx, parada) {
    const v = await ctx.base.una("select id, estado, contrato_id from visitas where edificio_id = ? and fecha = ?", [parada.edificioId, ctx.hoy]);
    if (v) return v;
    const id = uuidv7();
    const contrato = parada.contratoId ?? (await contratoDe(ctx))?.id ?? null;
    await ctx.base.ejecutar("insert into visitas (id, edificio_id, orden_id, contrato_id, fecha) values (?, ?, ?, ?, ?)", [id, parada.edificioId, parada.ordenId, contrato, ctx.hoy]);
    return { id, estado: "abierta", contrato_id: contrato };
  }
  async function visitasSinCerrar(ctx) {
    return ctx.base.todas(
      `select v.id, v.edificio_id, v.orden_id, v.contrato_id, v.fecha, v.estado, coalesce(e.nombre, '') as nombre
       from visitas v left join edificios e on e.id = v.edificio_id
      where v.estado = 'abierta' and v.fecha < ?
        and (exists (select 1 from visita_equipos ve where ve.visita_id = v.id and ve.terminado = 1)
          or exists (select 1 from intervenciones i join equipos q on q.id = i.equipo_id
                      where q.edificio_id = v.edificio_id and i.tecnico_id = ? and i.estado = 'borrador' and substr(i.realizada_en, 1, 10) = v.fecha)
          or exists (select 1 from operaciones_mantenimiento o
                      where o.edificio_id = v.edificio_id and o.tecnico_id = ? and o.estado = 'borrador' and substr(o.realizada_en, 1, 10) = v.fecha))
      order by v.fecha, v.rowid`,
      [ctx.hoy, ctx.usuarioId, ctx.usuarioId]
    );
  }
  async function visitaPorId(base2, id) {
    return base2.una(`select v.id, v.edificio_id, v.orden_id, v.contrato_id, v.fecha, v.estado, coalesce(e.nombre, '') as nombre
    from visitas v left join edificios e on e.id = v.edificio_id where v.id = ?`, [id]);
  }
  function contextoDeVisita(ctx, v) {
    return { ...ctx, hoy: v.fecha };
  }
  function tieneAlgo(h) {
    return Boolean(h.control || h.cargas.length || h.recuperaciones.length || h.operaciones.length || h.desmontaje);
  }
  async function contratoDe(ctx) {
    return ctx.base.una(`select id, mantenedora_id from contratos where mantenedora_id = ? and estado = 'vigente' and inicio <= ? and (fin is null or fin >= ?) order by inicio desc limit 1`, [ctx.organizacionId, ctx.hoy, ctx.hoy]);
  }
  var COLS_EQUIPO = `e.id, e.tag, e.tipo, e.refrigerante, e.carga_kg, e.hermetico, e.deteccion_fugas, e.en_vivienda, e.potencia_frio_kw,
  e.potencia_calor_kw, e.descripcion, e.edificio_id, e.titular_id, e.instalacion_id, e.fabricante, e.modelo, e.numero_serie,
  e.fecha_instalacion, e.qr_token, e.estado, coalesce(u.nombre, u.codigo) as ubicacion`;
  var DESMONTADO = `exists (select 1 from intervenciones d where d.equipo_id = e.id and d.tipo = 'desmantelamiento' and d.borrado_en is null)`;
  async function equiposDelEdificio(base2, edificioId, opciones = {}) {
    const filtro = opciones.conDesmontadosHoy ? `(e.estado = 'activo' or exists (select 1 from intervenciones d where d.equipo_id = e.id and d.tipo = 'desmantelamiento' and d.estado = 'borrador'))` : `e.estado = 'activo' and not ${DESMONTADO}`;
    return base2.todas(
      `select ${COLS_EQUIPO} from equipos e left join ubicaciones u on u.id = e.ubicacion_id
      where e.edificio_id = ? and e.borrado_en is null and ${filtro}
      order by coalesce(u.orden, 9999), e.tag`,
      [edificioId]
    );
  }
  async function desmontadoEl(base2, equipoId) {
    const r = await base2.una(
      `select (select min(substr(d.realizada_en, 1, 10)) from intervenciones d where d.equipo_id = e.id and d.tipo = 'desmantelamiento' and d.borrado_en is null) as f,
            e.estado from equipos e where e.id = ?`,
      [equipoId]
    );
    if (!r) return null;
    return r.f ?? (r.estado === "desmantelado" ? "" : null);
  }
  async function exigirEnServicio(ctx, e) {
    if (await desmontadoEl(ctx.base, e.id) !== null) throw new Bloqueo("desmontado", `${e.tag} est\xE1 dado de baja: ya no admite gas ni controles.`);
  }
  async function equipo(base2, id) {
    return base2.una(`select ${COLS_EQUIPO} from equipos e left join ubicaciones u on u.id = e.ubicacion_id where e.id = ?`, [id]);
  }
  async function buscarPorQr(base2, texto2) {
    const token = texto2.trim().split(/[/?#=]/).filter(Boolean).pop() ?? "";
    return base2.una(
      `select ${COLS_EQUIPO} from equipos e left join ubicaciones u on u.id = e.ubicacion_id
      where (e.qr_token = ? or upper(e.tag) = upper(?)) and e.borrado_en is null limit 1`,
      [token, token]
    );
  }
  async function ultimoControl(base2, equipoId) {
    const r = await base2.una(
      `select max(substr(realizada_en, 1, 10)) as f from intervenciones i
      where i.equipo_id = ? and i.tipo = 'control_fugas' and i.resultado in ('sin_fugas', 'fuga_reparada') and i.borrado_en is null
        and not exists (select 1 from intervenciones a where a.anula_a_id = i.id and a.estado = 'firmado')`,
      [equipoId]
    );
    return r?.f ?? null;
  }
  async function estadoDeEquipos(ctx, edificioId, visitaId) {
    const eqs = await equiposDelEdificio(ctx.base, edificioId);
    const r = [];
    for (const e of eqs) r.push(await estadoDeEquipo(ctx, e, visitaId));
    return r;
  }
  async function estadoDeEquipo(ctx, e, visitaId) {
    const u = await ultimoControl(ctx.base, e.id);
    const gas = fichaGas(e, u, ctx.hoy);
    const terminado = visitaId ? Boolean(await ctx.base.una("select 1 from visita_equipos where visita_id = ? and equipo_id = ? and terminado = 1", [visitaId, e.id])) : false;
    const hecho = await hechoHoy(ctx, e.id);
    const hechoHoyControl = Boolean(hecho.control);
    const it3 = await it3DeHoy(ctx, e);
    return {
      equipo: e,
      gas,
      ultimoControl: u,
      terminado,
      faltaFugas: Boolean(gas?.control.sujeto && !hecho.control && !hecho.desmontaje),
      faltaIt3: Boolean(it3.hoy.length && !hecho.operaciones.length && !hecho.desmontaje),
      vencido: Boolean(gas?.control.sujeto && gas.proximo.vencido && !hechoHoyControl),
      venceHoy: Boolean(gas?.control.sujeto && gas.proximo.diasRestantes === 0 && !hechoHoyControl)
    };
  }
  async function siguientePendiente(ctx, edificioId, visitaId, actualId) {
    const eqs = await equiposDelEdificio(ctx.base, edificioId);
    const hechos = new Set((await ctx.base.todas("select equipo_id from visita_equipos where visita_id = ? and terminado = 1", [visitaId])).map((x) => x.equipo_id));
    const i = actualId ? eqs.findIndex((e) => e.id === actualId) : -1;
    const orden = [...eqs.slice(i + 1), ...eqs.slice(0, Math.max(i, 0))];
    return orden.find((e) => e.id !== actualId && !hechos.has(e.id)) ?? null;
  }
  async function borradoresDeHoy(ctx, equipoId) {
    return ctx.base.todas(
      `select id, tipo, resultado, observaciones, realizada_en, estado from intervenciones
      where equipo_id = ? and tecnico_id = ? and estado = 'borrador' and substr(realizada_en, 1, 10) = ? order by realizada_en`,
      [equipoId, ctx.usuarioId, ctx.hoy]
    );
  }
  async function controlDeHoy(ctx, equipoId) {
    return (await borradoresDeHoy(ctx, equipoId)).find((i) => i.tipo === "control_fugas") ?? null;
  }
  async function hechoHoy(ctx, equipoId) {
    const b = await borradoresDeHoy(ctx, equipoId);
    const conMov = async (i) => ({ ...i, movimientos: await ctx.base.todas("select id, intervencion_id, sentido, kg, origen, cilindro, lote from movimientos_gas where intervencion_id = ?", [i.id]) });
    return {
      control: b.find((i) => i.tipo === "control_fugas") ?? null,
      cargas: await Promise.all(b.filter((i) => i.tipo === "carga").map(async (i) => ({
        ...await conMov(i),
        arrastra: Boolean(await ctx.base.una("select 1 from enlaces_borrador l join intervenciones d on d.id = l.intervencion_id where l.depende_de = ?", [i.id]))
      }))),
      recuperaciones: await Promise.all(b.filter((i) => i.tipo === "recuperacion").map(conMov)),
      desmontaje: b.some((i) => i.tipo === "desmantelamiento"),
      operaciones: await ctx.base.todas(
        `select id, codigo_operacion, resultado, observaciones from operaciones_mantenimiento
        where equipo_id = ? and tecnico_id = ? and estado = 'borrador' and substr(realizada_en, 1, 10) = ?`,
        [equipoId, ctx.usuarioId, ctx.hoy]
      )
    };
  }
  async function historial(base2, equipoId) {
    return base2.todas(
      `select i.id, i.tipo, i.resultado, i.observaciones, i.realizada_en, i.estado, i.tecnico_nombre,
            (select sum(kg) from movimientos_gas m where m.intervencion_id = i.id) as kg,
            (select max(origen) from movimientos_gas m where m.intervencion_id = i.id) as origen,
            (select max(cilindro) from movimientos_gas m where m.intervencion_id = i.id) as cilindro
       from intervenciones i where i.equipo_id = ? and i.borrado_en is null
      union all
     select o.id, 'it3' as tipo, o.resultado, o.observaciones, o.realizada_en, o.estado, null, null, null, null
       from operaciones_mantenimiento o where o.equipo_id = ? and o.borrado_en is null
      order by 5 desc limit 40`,
      [equipoId, equipoId]
    );
  }
  async function misCertificados(ctx) {
    return ctx.base.todas("select esquema, categoria, numero, expedido_el, caduca_el from certificados_tecnico where usuario_id = ? and borrado_en is null order by esquema, caduca_el desc", [ctx.usuarioId]);
  }
  async function puedo(ctx, actividad, e) {
    return habilitacion(await misCertificados(ctx), actividad, Number(e.carga_kg ?? 0), ctx.hoy);
  }
  var DE_LA_FURGONETA = `borrado_en is null and coalesce(estado, 'en_uso') <> 'devuelto'`;
  var DE_ESTE_TECNICO = `(tecnico_id = ? or (tecnico_id is null and organizacion_id is null))`;
  async function cilindros(base2, usuarioId) {
    if (usuarioId === void 0) return base2.todas(`select * from cilindros where ${DE_LA_FURGONETA} order by uso, refrigerante, codigo`);
    return base2.todas(`select * from cilindros where ${DE_LA_FURGONETA} and ${DE_ESTE_TECNICO} order by uso, refrigerante, codigo`, [usuarioId]);
  }
  async function cilindroPorCodigo(base2, texto2, usuarioId) {
    const codigo = texto2.trim().split(/[/?#=]/).filter(Boolean).pop() ?? "";
    const donde = `(upper(codigo) = upper(?) or id = ?) and ${DE_LA_FURGONETA}`;
    if (usuarioId === void 0) return base2.una(`select * from cilindros where ${donde}`, [codigo, codigo]);
    return base2.una(`select * from cilindros where ${donde} and ${DE_ESTE_TECNICO}`, [codigo, codigo, usuarioId]);
  }
  async function moverKg(base2, cilindro, delta) {
    const c = cilindro.id ? await base2.una("select id, kg, organizacion_id from cilindros where id = ?", [cilindro.id]) : await base2.una(
      "select id, kg, organizacion_id from cilindros where upper(codigo) = upper(?) and borrado_en is null order by organizacion_id is null",
      [cilindro.codigo ?? ""]
    );
    if (!c) return;
    const kg2 = Math.round((Number(c.kg) + delta) * 1e3) / 1e3;
    if (c.organizacion_id) await actualizar(base2, "cilindros", c.id, { kg: kg2 });
    else await base2.ejecutar("update cilindros set kg = ? where id = ?", [kg2, c.id]);
  }
  async function altaCilindro(ctx, n) {
    const codigo = n.codigo.trim();
    if (!codigo) throw new Bloqueo("codigo", "Falta el c\xF3digo del cilindro.");
    if (!ctx.organizacionId) throw new Bloqueo("empresa", "No perteneces a ninguna empresa mantenedora en Vidaire: pide a la oficina que te d\xE9 de alta.");
    if (!(n.kg >= 0)) throw new Bloqueo("cantidad", "Escribe los kg que lleva.");
    const cap = n.capacidad_kg && n.capacidad_kg > 0 ? n.capacidad_kg : null;
    if (cap !== null && n.kg > cap + 1e-9) throw new Bloqueo("capacidad", `Lleva m\xE1s de lo que cabe: ${kg(n.kg)} de ${kg(cap)} kg.`);
    const origen = n.uso === "carga" ? n.origen ?? "virgen" : null;
    const lugar = origen && origen !== "virgen" ? (n.lugar_tratamiento ?? "").trim() : "";
    if (origen && origen !== "virgen" && !lugar) throw new Bloqueo("tratamiento", `Un gas ${origen} lleva d\xF3nde se trat\xF3 (art. 7.1.c): escribe la planta o la empresa.`);
    const ya = await ctx.base.una("select id from cilindros where upper(codigo) = upper(?) and borrado_en is null and (organizacion_id = ? or organizacion_id is null)", [codigo, ctx.organizacionId]);
    if (ya) throw new Bloqueo("repetido", `Ya hay un cilindro ${codigo} en tu empresa.`);
    const id = uuidv7();
    await insertar(ctx.base, "cilindros", {
      id,
      organizacion_id: ctx.organizacionId,
      tecnico_id: ctx.usuarioId,
      codigo,
      uso: n.uso,
      refrigerante: n.refrigerante,
      origen,
      kg: n.kg,
      capacidad_kg: cap,
      lote: n.lote?.trim() || null,
      lugar_tratamiento: lugar || null,
      reciclado_por_mi_empresa: origen === "reciclado" && n.reciclado_por_mi_empresa != null ? n.reciclado_por_mi_empresa ? 1 : 0 : null,
      estado: "en_uso"
    });
    return id;
  }
  async function nuevaIntervencion(ctx, v, e, tipo, resultado, observaciones) {
    const contrato = v.contrato_id ? await ctx.base.una("select mantenedora_id from contratos where id = ?", [v.contrato_id]) : null;
    const id = uuidv7();
    await insertarBorrador(ctx.base, "intervenciones", {
      id,
      equipo_id: e.id,
      edificio_id: e.edificio_id,
      contrato_id: v.contrato_id,
      empresa_id: contrato?.mantenedora_id ?? ctx.organizacionId,
      tecnico_id: ctx.usuarioId,
      tipo,
      realizada_en: ahora(ctx),
      resultado,
      observaciones,
      estado: "borrador",
      tecnico_nombre: ctx.usuarioNombre
    });
    return id;
  }
  var Bloqueo = class extends Error {
    motivo;
    constructor(motivo, mensaje) {
      super(mensaje);
      this.motivo = motivo;
    }
  };
  async function exigirHabilitacion(ctx, actividad, e) {
    if (!e.refrigerante) return;
    const h = await puedo(ctx, actividad, e);
    if (!h.puede) throw new Bloqueo("certificado", h.explicacion);
  }
  async function sinFuga(ctx, v, e) {
    await exigirEnServicio(ctx, e);
    await exigirHabilitacion(ctx, "control_fugas", e);
    const previo = await controlDeHoy(ctx, e.id);
    if (previo) await borrarBorrador(ctx, previo.id);
    return nuevaIntervencion(ctx, v, e, "control_fugas", "sin_fugas", null);
  }
  async function hayFuga(ctx, v, e, donde, reparada, cargaId) {
    await exigirEnServicio(ctx, e);
    await exigirHabilitacion(ctx, "control_fugas", e);
    const previo = await controlDeHoy(ctx, e.id);
    if (previo) await borrarBorrador(ctx, previo.id);
    const id = await nuevaIntervencion(ctx, v, e, "control_fugas", reparada ? "fuga_reparada" : "fuga_detectada", donde);
    if (cargaId) await ctx.base.ejecutar("insert or replace into enlaces_borrador (intervencion_id, depende_de) values (?, ?)", [id, cargaId]);
    return id;
  }
  async function respuestaFuga(ctx, v, e, r, cargaId) {
    return hayFuga(ctx, v, e, r === "no_localizada" ? "no_localizada" : "localizada", r === "reparada", cargaId);
  }
  async function borrarBorrador(ctx, intervencionId) {
    const i = await ctx.base.una("select estado, version from intervenciones where id = ?", [intervencionId]);
    if (!i || i.estado !== "borrador" || i.version > 0) return;
    const hijos = (await ctx.base.todas(`select l.intervencion_id as id from enlaces_borrador l join intervenciones d on d.id = l.intervencion_id
    where l.depende_de = ? and d.estado = 'borrador' and d.version = 0`, [intervencionId])).map((x) => x.id);
    await ctx.base.transaccion(async () => {
      for (const id of [intervencionId, ...hijos]) {
        const movs = await ctx.base.todas("select sentido, kg, cilindro from movimientos_gas where intervencion_id = ?", [id]);
        for (const m of movs) {
          await moverKg(ctx.base, { codigo: m.cilindro }, m.sentido === "carga" ? m.kg : -m.kg);
        }
        await ctx.base.ejecutar("delete from movimientos_gas where intervencion_id = ?", [id]);
        await ctx.base.ejecutar("delete from intervenciones where id = ?", [id]);
        await ctx.base.ejecutar("delete from enlaces_borrador where intervencion_id = ? or depende_de = ?", [id, id]);
      }
    });
  }
  async function cargarGas(ctx, v, e, c, kg2) {
    await exigirEnServicio(ctx, e);
    const comp = comprobarCilindro(e, c, ctx.hoy);
    if (comp.estado === "otro_gas") throw new Bloqueo("otro_gas", `El cilindro ${c.codigo} es de ${c.refrigerante} y el equipo lleva ${e.refrigerante}.`);
    if (comp.estado === "prohibido") throw new Bloqueo("art13", comp.resultado.explicacion);
    if (comp.estado === "vacio") throw new Bloqueo("vacio", `El cilindro ${c.codigo} est\xE1 vac\xEDo.`);
    if (!(kg2 > 0)) throw new Bloqueo("cantidad", "Escribe los kg que a\xF1ades.");
    const actual = await ctx.base.una("select kg from cilindros where id = ?", [c.id]);
    if (!actual || kg2 > actual.kg + 1e-9) throw new Bloqueo("cantidad", `En el ${c.codigo} solo quedan ${kg(actual?.kg ?? 0)} kg. Carga eso y a\xF1ade el resto desde otro cilindro.`);
    await exigirHabilitacion(ctx, "carga", e);
    let id = "";
    await ctx.base.transaccion(async () => {
      id = await nuevaIntervencion(ctx, v, e, "carga", null, null);
      await insertarBorrador(ctx.base, "movimientos_gas", {
        id: uuidv7(),
        intervencion_id: id,
        sentido: "carga",
        refrigerante: e.refrigerante,
        kg: kg2,
        origen: c.origen ?? "virgen",
        lugar_tratamiento: c.origen && c.origen !== "virgen" ? c.lugar_tratamiento : null,
        cilindro: c.codigo,
        lote: c.lote
      });
      await moverKg(ctx.base, { id: c.id }, -kg2);
    });
    const control = await controlDeHoy(ctx, e.id);
    const conFuga = control && control.resultado !== "sin_fugas";
    return { id, preguntarFuga: !conFuga, porcentaje: e.carga_kg ? kg2 / Number(e.carga_kg) * 100 : 0 };
  }
  async function recuperarGas(ctx, v, e, c, kg2, motivo) {
    await exigirEnServicio(ctx, e);
    const valido = cilindroDeRecuperacion(e, [c]);
    if (!valido) throw new Bloqueo("otro_gas", `El cilindro ${c.codigo} no es de recuperaci\xF3n de ${e.refrigerante}.`);
    if (!(kg2 > 0)) throw new Bloqueo("cantidad", "Escribe los kg que recuperas.");
    const lleva = Number((await ctx.base.una("select kg from cilindros where id = ?", [c.id]))?.kg ?? c.kg);
    if (c.capacidad_kg !== null && lleva + kg2 > c.capacidad_kg + 1e-9) throw new Bloqueo("capacidad", `No cabe: el cilindro ${c.codigo} lleva ${lleva} de ${c.capacidad_kg} kg.`);
    await exigirHabilitacion(ctx, "recuperacion", e);
    let id = "";
    await ctx.base.transaccion(async () => {
      id = await nuevaIntervencion(ctx, v, e, "recuperacion", null, motivo === "desmontaje" ? "desmontaje" : "para_reparar");
      await insertarBorrador(ctx.base, "movimientos_gas", {
        id: uuidv7(),
        intervencion_id: id,
        sentido: "recuperacion",
        refrigerante: e.refrigerante,
        kg: kg2,
        origen: null,
        lugar_tratamiento: null,
        cilindro: c.codigo,
        lote: c.lote
      });
      await moverKg(ctx.base, { id: c.id }, kg2);
      if (motivo === "desmontaje") {
        await nuevaIntervencion(ctx, v, e, "desmantelamiento", "no_aplica", null);
        await ctx.base.ejecutar("insert into visita_equipos (visita_id, equipo_id, terminado) values (?, ?, 1) on conflict (visita_id, equipo_id) do update set terminado = 1", [v.id, e.id]);
      }
    });
    return id;
  }
  async function it3DeHoy(ctx, e) {
    const inst = e.instalacion_id ? await ctx.base.una("select max(coalesce(potencia_frio_kw, 0), coalesce(potencia_calor_kw, 0)) as p from instalaciones where id = ?", [e.instalacion_id]) : null;
    const ed = await ctx.base.una("select uso from edificios where id = ?", [e.edificio_id]);
    const ultimas = await ctx.base.todas(
      `select codigo_operacion, max(realizada_en) as f from operaciones_mantenimiento
      where equipo_id = ? and resultado in ('correcto', 'corregido') and borrado_en is null and substr(realizada_en, 1, 10) < ? group by codigo_operacion`,
      [e.id, ctx.hoy]
    );
    return operacionesIt3(e, inst?.p || null, ed?.uso ?? null, new Map(ultimas.map((u) => [u.codigo_operacion, u.f])), ctx.hoy);
  }
  async function guardarIt3(ctx, v, e, ops) {
    await exigirEnServicio(ctx, e);
    const contrato = v.contrato_id ? await ctx.base.una("select mantenedora_id from contratos where id = ?", [v.contrato_id]) : null;
    const ids = [];
    await ctx.base.transaccion(async () => {
      await ctx.base.ejecutar(`delete from operaciones_mantenimiento where equipo_id = ? and tecnico_id = ? and estado = 'borrador' and version = 0 and substr(realizada_en, 1, 10) = ?`, [e.id, ctx.usuarioId, ctx.hoy]);
      for (const o of ops) {
        const id = uuidv7();
        ids.push(id);
        await insertarBorrador(ctx.base, "operaciones_mantenimiento", {
          id,
          edificio_id: e.edificio_id,
          instalacion_id: e.instalacion_id,
          equipo_id: e.id,
          contrato_id: v.contrato_id,
          empresa_id: contrato?.mantenedora_id ?? ctx.organizacionId,
          tecnico_id: ctx.usuarioId,
          codigo_operacion: o.op.codigo,
          periodicidad: o.op.periodicidad,
          realizada_en: ahora(ctx),
          resultado: o.hecha ? "correcto" : "no_aplica",
          observaciones: o.hecha ? null : `no_hecha:${o.motivo ?? "otro"}`,
          estado: "borrador"
        });
      }
    });
    return ids;
  }
  async function deshacerIt3(ctx, ids) {
    for (const id of ids) await ctx.base.ejecutar(`delete from operaciones_mantenimiento where id = ? and version = 0 and estado = 'borrador'`, [id]);
  }
  async function terminarEquipo(ctx, v, e, edificioId) {
    const h = await hechoHoy(ctx, e.id);
    const est = await estadoDeEquipo(ctx, e, v.id);
    if (est.gas?.control.sujeto && !h.control && !h.desmontaje) return { falta: "fugas", siguiente: null };
    const it3 = await it3DeHoy(ctx, e);
    if (it3.hoy.length && !h.operaciones.length && !h.desmontaje) return { falta: "it3", siguiente: null };
    await ctx.base.ejecutar("insert into visita_equipos (visita_id, equipo_id, terminado) values (?, ?, 1) on conflict (visita_id, equipo_id) do update set terminado = 1", [v.id, e.id]);
    return { falta: null, siguiente: await siguientePendiente(ctx, edificioId, v.id, e.id) };
  }
  async function resumenVisita(ctx, edificioId, visitaId) {
    const eqs = await equiposDelEdificio(ctx.base, edificioId, { conDesmontadosHoy: true });
    const r = [];
    for (const e of eqs) {
      const terminado = Boolean(await ctx.base.una("select 1 from visita_equipos where visita_id = ? and equipo_id = ? and terminado = 1", [visitaId, e.id]));
      r.push({ equipo: e, hoy: await hechoHoy(ctx, e.id), terminado });
    }
    return r;
  }
  async function cerrarVisita(ctx, v, edificioId, firmas) {
    let nI = 0;
    let nO = 0;
    await ctx.base.transaccion(async () => {
      const ed = await ctx.base.una("select titular_id from edificios where id = ?", [edificioId]);
      const titular = ed?.titular_id ?? "sin-titular";
      const interv = await ctx.base.todas(
        `select i.id, i.equipo_id, i.tipo from intervenciones i join equipos e on e.id = i.equipo_id
        where e.edificio_id = ? and i.tecnico_id = ? and i.estado = 'borrador' and i.version = 0 and substr(i.realizada_en, 1, 10) = ?`,
        [edificioId, ctx.usuarioId, ctx.hoy]
      );
      for (const i of interv) {
        const obs = firmas.cliente.enlace && !firmas.cliente.svg ? "firma_cliente_por_enlace" : null;
        await cambiarBorrador(ctx.base, "intervenciones", i.id, {
          firmante_cliente_nombre: firmas.cliente.nombre,
          firmante_cliente_cargo: firmas.cliente.cargo,
          estado: "firmado",
          ...obs ? { observaciones: [await obsDe(ctx, i.id), obs].filter(Boolean).join(" \xB7 ") } : {}
        });
        await firma(ctx, i.id, edificioId, titular, "firma_tecnico", firmas.tecnico);
        if (firmas.cliente.svg) await firma(ctx, i.id, edificioId, titular, "firma_cliente", firmas.cliente.svg);
        await ctx.base.ejecutar(`update intervenciones set estado = 'firmado' where id = ?`, [i.id]);
        await encolarIntervencion(ctx.base, i.id);
        nI++;
        if (i.tipo === "desmantelamiento") await actualizar(ctx.base, "equipos", i.equipo_id, { estado: "desmantelado" });
      }
      for (const d of await ctx.base.todas(`select d.id from documentos d join ficheros f on f.documento_id = d.id where f.subido = 0 and d.intervencion_id in (${interv.map(() => "?").join(", ") || "''"})`, interv.map((i) => i.id))) {
        await ctx.base.ejecutar(`insert into cola (tipo, tabla, fila_id, operacion, creado_en) values ('fichero', 'documentos', ?, 'subir', ?)`, [d.id, ahora(ctx)]);
      }
      const ops = await ctx.base.todas(
        `select id from operaciones_mantenimiento where edificio_id = ? and tecnico_id = ? and estado = 'borrador' and version = 0 and substr(realizada_en, 1, 10) = ?`,
        [edificioId, ctx.usuarioId, ctx.hoy]
      );
      for (const o of ops) {
        await ctx.base.ejecutar(`update operaciones_mantenimiento set estado = 'firmado' where id = ?`, [o.id]);
        await encolarSubida(ctx.base, "operaciones_mantenimiento", o.id);
        nO++;
      }
      await ctx.base.ejecutar(
        `update visitas set estado = 'cerrada', cerrada_en = ?, cliente_nombre = ?, cliente_cargo = ?, cliente_enlace = ? where id = ?`,
        [ahora(ctx), firmas.cliente.nombre, firmas.cliente.cargo, firmas.cliente.enlace ? 1 : 0, v.id]
      );
    });
    return { intervenciones: nI, operaciones: nO };
  }
  async function obsDe(ctx, id) {
    return (await ctx.base.una("select observaciones as o from intervenciones where id = ?", [id]))?.o ?? null;
  }
  async function firma(ctx, intervencionId, edificioId, titular, tipo, svg) {
    const doc = uuidv7();
    await insertarBorrador(ctx.base, "documentos", {
      id: doc,
      edificio_id: edificioId,
      titular_id: titular,
      intervencion_id: intervencionId,
      tipo,
      titulo: tipo,
      ruta: `${titular}/${edificioId}/${doc}.svg`,
      mime: "image/svg+xml",
      bytes: bytesUtf8(svg),
      estado_revision: "recibido"
    });
    await ctx.base.ejecutar("insert or replace into ficheros (documento_id, uri, contenido, mime, subido) values (?, null, ?, ?, 0)", [doc, svg, "image/svg+xml"]);
  }
  function bytesUtf8(s) {
    return new TextEncoder().encode(s).length;
  }
  async function avisarOficina(ctx, edificioId, equipoId, texto2) {
    await ctx.base.ejecutar("insert into avisos_oficina (id, edificio_id, equipo_id, texto, creado_en) values (?, ?, ?, ?, ?)", [uuidv7(), edificioId, equipoId, texto2, ahora(ctx)]);
  }
  async function altaEquipo(ctx, a) {
    const id = uuidv7();
    const carga = a.cargaFabricaKg ? Math.round((a.cargaFabricaKg + a.cargaAnadidaKg) * 1e3) / 1e3 : null;
    await ctx.base.transaccion(async () => {
      await insertar(ctx.base, "equipos", {
        id,
        edificio_id: a.edificioId,
        titular_id: a.titularId,
        ubicacion_id: a.ubicacionId,
        disciplina: "clima",
        tag: a.tag.trim().toUpperCase(),
        descripcion: a.descripcion ?? null,
        tipo: a.tipo,
        fabricante: a.fabricante,
        modelo: a.modelo,
        numero_serie: a.numeroSerie,
        refrigerante: a.refrigerante,
        carga_kg: carga,
        hermetico: 0,
        deteccion_fugas: 0,
        en_vivienda: 0,
        potencia_frio_kw: a.potenciaFrioKw,
        fecha_instalacion: ctx.hoy,
        qr_token: a.qrToken,
        estado: "activo",
        estado_montaje: "recepcionado",
        estado_pm: "hecha"
      });
      if (a.fotoPlaca) {
        const doc = uuidv7();
        await insertar(ctx.base, "documentos", {
          id: doc,
          edificio_id: a.edificioId,
          titular_id: a.titularId,
          equipo_id: id,
          tipo: "foto",
          titulo: `${a.tag} \xB7 placa`,
          ruta: `${a.titularId}/${a.edificioId}/${doc}.jpg`,
          mime: a.fotoPlaca.mime,
          estado_revision: "recibido"
        });
        await guardarFichero(ctx.base, doc, { uri: a.fotoPlaca.uri, mime: a.fotoPlaca.mime });
      }
    });
    return id;
  }
  function tagDeEtiqueta(qr) {
    return (qr ?? "").trim().split(/[/?#=]/).filter(Boolean).pop()?.toUpperCase() ?? "";
  }
  async function deshacerAlta(ctx, equipoId) {
    const docs = (await ctx.base.todas("select id from documentos where equipo_id = ?", [equipoId])).map((d) => d.id);
    const ids = [equipoId, ...docs];
    const marcas = ids.map(() => "?").join(", ");
    const e = await ctx.base.una("select version from equipos where id = ?", [equipoId]);
    const enCola = await ctx.base.una(`select count(*) as n from cola where tabla = 'equipos' and fila_id = ? and estado = 'pendiente'`, [equipoId]);
    if (!e || Number(e.version) > 0 || !Number(enCola?.n)) return false;
    const usado = await ctx.base.una("select 1 from intervenciones where equipo_id = ? union all select 1 from operaciones_mantenimiento where equipo_id = ? limit 1", [equipoId, equipoId]);
    if (usado) return false;
    await ctx.base.transaccion(async () => {
      await ctx.base.ejecutar(`delete from cola where fila_id in (${marcas}) and estado = 'pendiente'`, ids);
      await ctx.base.ejecutar(`delete from ficheros where documento_id in (${marcas})`, ids);
      await ctx.base.ejecutar(`delete from documentos where equipo_id = ?`, [equipoId]);
      await ctx.base.ejecutar("delete from visita_equipos where equipo_id = ?", [equipoId]);
      await ctx.base.ejecutar("delete from equipos where id = ?", [equipoId]);
    });
    return true;
  }
  async function ubicacionesDelEdificio(base2, edificioId) {
    return base2.todas(`select id, coalesce(nombre, codigo) as nombre from ubicaciones where edificio_id = ? and borrado_en is null order by orden, codigo`, [edificioId]);
  }
  function ahora(ctx) {
    return ctx.ahora ? ctx.ahora() : ahoraLocalISO();
  }

  // cxobra/mantenimiento/fuente/logica/incidencias.ts
  var incidencias_exports = {};
  __export(incidencias_exports, {
    deshacerCorregida: () => deshacerCorregida,
    fotoDeCorreccion: () => fotoDeCorreccion,
    incidenciasDeEquipo: () => incidenciasDeEquipo,
    marcarCorregida: () => marcarCorregida,
    misIncidencias: () => misIncidencias
  });
  async function adjuntarFoto(ctx, eq, incidenciaId, foto, cuando) {
    const doc = uuidv7();
    const ext = foto.mime === "image/png" ? "png" : foto.mime === "image/webp" ? "webp" : "jpg";
    await insertar(ctx.base, "documentos", {
      id: doc,
      edificio_id: eq.edificio_id,
      titular_id: eq.titular_id,
      equipo_id: eq.id,
      incidencia_id: incidenciaId,
      tipo: "foto",
      titulo: `${eq.tag} \xB7 ${cuando}`,
      ruta: `${eq.titular_id}/${eq.edificio_id}/${doc}.${ext}`,
      mime: foto.mime,
      estado_revision: "recibido"
    });
    await guardarFichero(ctx.base, doc, { uri: foto.uri, mime: foto.mime });
  }
  async function misIncidencias(base2, organizacionId, edificioId) {
    return base2.todas(
      `select i.id, i.titulo, i.descripcion, i.gravedad, i.estado, e.tag, i.equipo_id, i.creado_en, i.version,
            (select count(*) from documentos d where d.incidencia_id = i.id and d.tipo = 'foto') as fotos
       from incidencias i left join equipos e on e.id = i.equipo_id
      where i.responsable_org_id = ? and i.estado in ('abierta', 'asignada', 'corregida') and i.borrado_en is null
        and (?2 is null or i.edificio_id = ?2)
      order by case i.estado when 'corregida' then 1 else 0 end,
               case i.gravedad when 'critica' then 0 when 'importante' then 1 else 2 end, i.creado_en desc`,
      [organizacionId, edificioId ?? null]
    );
  }
  async function incidenciasDeEquipo(base2, equipoId) {
    return base2.todas(
      `select i.id, i.titulo, i.descripcion, i.gravedad, i.estado, e.tag, i.equipo_id, i.creado_en, i.version,
            (select count(*) from documentos d where d.incidencia_id = i.id and d.tipo = 'foto') as fotos
       from incidencias i left join equipos e on e.id = i.equipo_id
      where i.equipo_id = ? and i.borrado_en is null order by i.creado_en desc`,
      [equipoId]
    );
  }
  async function marcarCorregida(ctx, inc, foto) {
    if (inc.estado === "abierta") await actualizar(ctx.base, "incidencias", inc.id, { estado: "asignada" }, { juntar: false });
    await actualizar(ctx.base, "incidencias", inc.id, { estado: "corregida" }, { juntar: false });
    if (foto) {
      const i = await ctx.base.una("select equipo_id, edificio_id from incidencias where id = ?", [inc.id]);
      const eq = await ctx.base.una("select id, tag, edificio_id, titular_id from equipos where id = ?", [i?.equipo_id ?? null]);
      if (eq) await adjuntarFoto(ctx, eq, inc.id, foto, ahora2(ctx));
    }
  }
  async function fotoDeCorreccion(ctx, incidenciaId, foto) {
    const i = await ctx.base.una("select equipo_id from incidencias where id = ?", [incidenciaId]);
    const eq = await ctx.base.una("select id, tag, edificio_id, titular_id from equipos where id = ?", [i?.equipo_id ?? null]);
    if (eq) await adjuntarFoto(ctx, eq, incidenciaId, foto, ahora2(ctx));
  }
  async function deshacerCorregida(ctx, incidenciaId) {
    await actualizar(ctx.base, "incidencias", incidenciaId, { estado: "asignada" });
  }
  function ahora2(ctx) {
    return ctx.ahora ? ctx.ahora() : ahoraLocalISO();
  }

  // cxobra/mantenimiento/fuente/i18n/es.ts
  var es = {
    marca: { nombre: "Vidaire" },
    fecha: {
      meses: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
      dias: { 0: "Domingo", 1: "Lunes", 2: "Martes", 3: "Mi\xE9rcoles", 4: "Jueves", 5: "Viernes", 6: "S\xE1bado" }
    },
    comun: {
      aObra: "Obra",
      aMantenimiento: "Mantenimiento",
      volver: "Volver",
      abriendoFicha: "Cargando\u2026",
      equipoNoEsta: "Este equipo no est\xE1 en el m\xF3vil. Puede que lo hayan quitado de la ruta o de la obra, o que a\xFAn no haya llegado: busca de nuevo con cobertura.",
      deshacer: "Deshacer",
      cambiar: "Cambiar",
      ver: "Ver",
      si: "S\xED",
      no: "No",
      salir: "Salir de la cuenta",
      escanear: "Escanear equipo",
      terminarSiguiente: "Terminar \xB7 siguiente equipo",
      siguiente: "Siguiente: {tag} \xB7 {donde}",
      buscarDeNuevo: "Buscar de nuevo",
      cambiarAMantenimiento: "Cambiar a mantenimiento",
      cambiarAObra: "Cambiar a obra",
      guardar: "Guardar",
      salirPendiente: "Tienes {n} cosas sin enviar. Busca cobertura antes de salir.",
      salirPregunta: "\xBFSalir de la cuenta? Para volver a entrar har\xE1 falta cobertura.",
      salirPreguntaDemo: "\xBFSalir de los datos de ejemplo? Lo que has hecho en ellos se borra.",
      salirSi: "S\xED, salir",
      salirNo: "No, seguir aqu\xED"
    },
    cuenta: {
      titulo: "Tu cuenta",
      abrir: "Abrir tu cuenta",
      apariencia: "Apariencia",
      auto: "Autom\xE1tico",
      claro: "Claro",
      oscuro: "Oscuro",
      autoAyuda: "Autom\xE1tico sigue al m\xF3vil: claro u oscuro, seg\xFAn lo tengas puesto.",
      trabajo: "Trabajas en",
      obra: "Obra",
      mantenimiento: "Mantenimiento",
      correo: "Correo",
      empresas: "Empresas",
      sinEmpresa: "Ninguna todav\xEDa",
      unirme: "Unirme a otra empresa con un c\xF3digo",
      borrar: "Borrar mi cuenta"
    },
    acceso: {
      crear: {
        titulo: "Crear cuenta",
        paso: "Paso {n} de 2",
        nombre: "Nombre y apellidos",
        nombreAyuda: "Como en tu carn\xE9: es el nombre que sale en lo que firmes.",
        correo: "Correo",
        correoAyuda: "El de trabajo. Si tu empresa ya te invit\xF3, el mismo al que te escribi\xF3.",
        clave: "Contrase\xF1a",
        claveAyuda: "Al menos 8 letras o n\xFAmeros.",
        verClave: "Ver la contrase\xF1a",
        ocultarClave: "Ocultar la contrase\xF1a",
        crear: "Crear la cuenta",
        creando: "Creando la cuenta\u2026",
        yaTengo: "Ya tengo cuenta: entrar",
        falta: {
          nombre: "Falta tu nombre y al menos un apellido",
          correo: "Falta un correo bien escrito",
          clave: "La contrase\xF1a necesita al menos 8 letras o n\xFAmeros"
        }
      },
      codigo: {
        titulo: "Confirma tu correo",
        explicacion: "Te hemos mandado un c\xF3digo de 6 n\xFAmeros a {correo}. Escr\xEDbelo aqu\xED: no hace falta salir de la app.",
        etiqueta: "C\xF3digo del correo",
        confirmar: "Confirmar",
        confirmando: "Comprobando\u2026",
        reenviar: "Mandarme otro c\xF3digo",
        reenviado: "Te hemos mandado otro c\xF3digo.",
        noLlega: "Si no llega en unos minutos, mira en el correo no deseado.",
        otroCorreo: "Me he equivocado de correo",
        falta: "Faltan {n} n\xFAmeros"
      },
      problema: {
        ya_existe: "Ese correo ya tiene cuenta. Entra con \xE9l.",
        clave_debil: "Esa contrase\xF1a es muy f\xE1cil de adivinar. Prueba con otra m\xE1s larga.",
        correo_no_valido: "Ese correo no parece bien escrito. Rev\xEDsalo.",
        demasiados: "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.",
        cerrado: "Ahora mismo no se pueden crear cuentas nuevas. Pregunta en tu oficina.",
        codigo_mal: "Ese c\xF3digo no es el que te mandamos, o ya ha caducado. Rev\xEDsalo o pide otro.",
        sin_confirmar: "A\xFAn no has confirmado tu correo. Escribe el c\xF3digo que te mandamos.",
        credenciales: "El correo o la contrase\xF1a no son correctos.",
        sin_red: "No hay cobertura. Busca un sitio con se\xF1al y vuelve a intentarlo.",
        otro: "No ha salido bien. Vuelve a intentarlo en un momento."
      },
      unirse: {
        titulo: "C\xF3digo de invitaci\xF3n",
        sub: "El que te ha dado tu empresa",
        explicacion: "Escribe las 6 letras y n\xFAmeros que van despu\xE9s de VIDA-. El teclado solo tiene los que pueden salir en un c\xF3digo.",
        escanear: "Escanear el QR",
        unirme: "Unirme a la empresa",
        uniendo: "Uni\xE9ndote\u2026",
        falta: "Faltan {n} letras o n\xFAmeros",
        falta_1: "Falta 1 letra o n\xFAmero",
        borrar: "Borrar la \xFAltima",
        vaciar: "Empezar de nuevo",
        hecho: "Ya formas parte de la empresa. Tu trabajo ya est\xE1 en el m\xF3vil.",
        hechoLuego: "Ya formas parte de la empresa. Tu trabajo llegar\xE1 en cuanto haya buena cobertura.",
        sinSesion: "Para usar el c\xF3digo, primero entra o crea tu cuenta. Lo dejamos guardado: no tendr\xE1s que escribirlo otra vez.",
        irAEntrar: "Entrar o crear cuenta",
        sinCobertura: "Para unirte a una empresa hace falta cobertura.",
        qrNoVale: "Ese QR no es una invitaci\xF3n. Prueba a escribir el c\xF3digo."
      },
      motivo: {
        no_valido: "Ese c\xF3digo no existe. Revisa cada letra con quien te lo dio.",
        caducado: "Ese c\xF3digo ha caducado (duran 7 d\xEDas). Pide uno nuevo a tu empresa.",
        agotado: "Ese c\xF3digo ya se ha usado todas las veces que permit\xEDa. Pide uno nuevo.",
        anulado: "Tu empresa ha anulado ese c\xF3digo. Pide uno nuevo.",
        otro_correo: "Ese c\xF3digo es para otro correo. Entra con el correo al que te invitaron, o pide uno para {correo}.",
        ya_usado: "Ya usaste ese c\xF3digo. Para volver a la empresa hace falta una invitaci\xF3n nueva.",
        falta_organizacion: "Ese c\xF3digo es para que una empresa acepte un contrato. Lo acepta la oficina desde el panel, en el ordenador.",
        demasiados_intentos: "Has probado demasiados c\xF3digos seguidos. Espera una hora y vuelve a intentarlo.",
        sin_red: "No hay cobertura. Busca un sitio con se\xF1al y vuelve a intentarlo.",
        demo: "Con los datos de ejemplo no te unes a ninguna empresa. Sal y entra con tu cuenta.",
        otro: "No ha salido bien. Vuelve a intentarlo en un momento."
      },
      invitaciones: {
        titulo: "Invitaciones",
        sub: "Te han invitado a una empresa",
        explicacion: "Estas empresas te han invitado a tu correo. No entras en ninguna hasta que pulses \xABUnirme\xBB; entonces su trabajo baja a este m\xF3vil.",
        como: "Como {rol}",
        quedan: "Caduca en {n} d\xEDas",
        quedan_1: "Caduca ma\xF1ana",
        hoy: "Caduca hoy",
        aceptar: "Unirme",
        rechazar: "No, gracias",
        rechazada: "Rechazada. La empresa ver\xE1 que has dicho que no. Si cambias de idea, pide que te invite otra vez.",
        rechazadaLuego: "Rechazada en este m\xF3vil. Se avisar\xE1 a la empresa en cuanto haya cobertura.",
        ninguna: "No tienes invitaciones pendientes.",
        ahoraNo: "Decidir m\xE1s tarde",
        pendientes: "Invitaciones pendientes ({n})",
        pendientes_1: "1 invitaci\xF3n pendiente"
      },
      rol: {
        tecnico: "t\xE9cnico",
        jefe: "jefe de equipo",
        administracion: "administraci\xF3n",
        responsable_tecnico: "responsable t\xE9cnico",
        lector: "solo consulta"
      },
      sinEmpresa: {
        titulo: "Sin empresa",
        sub: "A\xFAn no trabajas para ninguna",
        explicacion: "Tu cuenta est\xE1 lista, pero todav\xEDa no perteneces a ninguna empresa. Para ver tu trabajo, la oficina de tu empresa tiene que invitarte.",
        pasos: "Qu\xE9 hacer",
        paso1: "Pide a tu oficina que te invite a {correo}.",
        paso2: "Te dar\xE1n un c\xF3digo VIDA-\u2026 o te ense\xF1ar\xE1n un QR.",
        paso3: "Pulsa \xABTengo un c\xF3digo\xBB y escr\xEDbelo o escan\xE9alo.",
        tuCorreo: "tu correo",
        tengoCodigo: "Tengo un c\xF3digo",
        escanear: "Escanear el QR",
        comprobar: "Ya me han invitado: comprobar",
        comprobando: "Comprobando\u2026",
        nada: "Todav\xEDa no hay ninguna invitaci\xF3n para tu correo.",
        empresaNueva: "\xBFTu empresa a\xFAn no usa {marca}? La da de alta su oficina desde el panel, en el ordenador. Despu\xE9s te invitan.",
        baja: "Ya no perteneces a {empresa}. Lo que firmaste sigue firmado y lo conserva la empresa."
      },
      borrar: {
        titulo: "Borrar mi cuenta",
        sub: "No tiene vuelta atr\xE1s",
        queSeBorra: "Qu\xE9 se borra",
        borra1: "Tu nombre en la cuenta, tu correo, tu tel\xE9fono y tu contrase\xF1a.",
        borra2: "Tus carn\xE9s y certificados personales.",
        borra3: "Tu sitio en las empresas. El trabajo que ten\xEDas asignado vuelve a la oficina.",
        borra4: "Todo lo guardado en este m\xF3vil.",
        queSeConserva: "Qu\xE9 se conserva, y por qu\xE9",
        conserva1: "Lo que firmaste (controles de fugas, gas cargado y recuperado, revisiones, pruebas y actas) sigue firmado con tu nombre y tu n\xBA de certificado, como estaba el d\xEDa de la firma.",
        conserva2: "La ley obliga a guardarlo al menos 5 a\xF1os (Reglamento UE 2024/573, art. 7). Por eso no se puede borrar, ni siquiera desde la oficina.",
        escribe: "Para confirmarlo, escribe {palabra}:",
        palabra: "BORRAR",
        boton: "Borrar mi cuenta para siempre",
        borrando: "Borrando\u2026",
        falta: "Escribe {palabra} para poder pulsar",
        pendientes: "Tienes {n} cosas sin enviar a la oficina. Si borras ahora se perder\xEDan: env\xEDalas primero.",
        pendientes_1: "Tienes 1 cosa sin enviar a la oficina. Si borras ahora se perder\xEDa: env\xEDala primero.",
        enviar: "Enviar ahora",
        sinCobertura: "Para borrar la cuenta hace falta cobertura.",
        hecho: "Tu cuenta se ha borrado.",
        demo: "Con los datos de ejemplo no hay cuenta que borrar: se borran los datos de ejemplo de este m\xF3vil.",
        ultimaAdmin: "Eres la \xFAnica administradora de {empresas}: nombra a otra persona desde el panel antes de borrar tu cuenta. No se ha borrado nada.",
        ultimaAdminVarias: "Eres la \xFAnica administradora de {empresas}: nombra a otra persona en cada una desde el panel antes de borrar tu cuenta. No se ha borrado nada.",
        ultimaAdminTitulo: "C\xF3mo nombrar a otra persona",
        ultimaAdminPaso1: "En el ordenador, entra en el panel con tu cuenta.",
        ultimaAdminPaso2: "En \xABEquipo\xBB, cambia el papel de otra persona a \xABjefe de equipo\xBB o \xABadministraci\xF3n\xBB.",
        ultimaAdminPaso3: "Vuelve aqu\xED y pulsa otra vez \xABBorrar mi cuenta para siempre\xBB.",
        y: "y",
        problema: {
          sin_red: "No hay cobertura. Busca un sitio con se\xF1al y vuelve a intentarlo.",
          otro: "No se ha podido borrar. Vuelve a intentarlo en un momento."
        }
      }
    },
    cobertura: {
      corto: { sinPendientes: "Sin cobertura \xB7 {n} por enviar", demo: "Ejemplo" },
      sin: "Sin cobertura \xB7 se guarda en el m\xF3vil",
      sinConPendientes: "Sin cobertura \xB7 se guarda en el m\xF3vil \xB7 {n} por enviar",
      enviando: "Con cobertura \xB7 {n} por enviar",
      todoEnviado: "Con cobertura \xB7 todo enviado",
      demo: "datos de ejemplo: no sale nada del m\xF3vil",
      conDemo: "Con cobertura \xB7 {n} guardados en el m\xF3vil",
      rechazados: "{n} cambios no se han podido guardar en la oficina. Avisa a tu jefe; siguen en el m\xF3vil.",
      conflictos: "Alguien cambi\xF3 a la vez {n} datos que t\xFA tambi\xE9n cambiaste: se ha quedado lo de la oficina.",
      con: "Con cobertura",
      seEnviaraSolo: "Sin cobertura: se enviar\xE1 solo cuando vuelva",
      demoNoEnvia: "Datos de ejemplo: no se env\xEDa nada",
      enviandoAhora: "Enviando {n}\u2026"
    },
    entrar: {
      crearCuenta: "Crear cuenta nueva",
      primeraVez: "\xBFEs la primera vez? Crea tu cuenta con tu correo de trabajo.",
      codigoGuardado: "Tienes guardado el c\xF3digo {codigo}. Entra o crea tu cuenta y te unimos a la empresa.",
      sub: "Entra con tu cuenta de trabajo",
      correo: "Correo",
      clave: "Contrase\xF1a",
      entrar: "Entrar",
      entrando: "Entrando\u2026",
      demo: "Probar con datos de ejemplo",
      explicacion: "Solo hace falta cobertura para entrar la primera vez. Despu\xE9s, todo se guarda en el m\xF3vil y se env\xEDa solo cuando hay cobertura.",
      sinCobertura: "Ahora no hay cobertura. Para entrar la primera vez hace falta; si solo quieres verla, prueba con los datos de ejemplo.",
      sinServidor: "Esta copia de la app no tiene servidor configurado: solo funciona con los datos de ejemplo.",
      problema: {
        credenciales: "El correo o la contrase\xF1a no son correctos. Rev\xEDsalos y vuelve a intentarlo.",
        sin_red: "No hay cobertura. Busca un sitio con se\xF1al y vuelve a intentarlo.",
        sin_servidor: "Esta copia de la app no tiene servidor configurado.",
        sin_confirmar: "A\xFAn no has confirmado tu correo. Escribe el c\xF3digo de 6 n\xFAmeros que te mandamos.",
        base: "El m\xF3vil a\xFAn est\xE1 preparando la app. Espera un momento y vuelve a intentarlo."
      }
    },
    escanear: {
      subInvitacion: "Apunta al QR de la invitaci\xF3n",
      escribirCodigo: "Escribir el c\xF3digo",
      titulo: "Escanear",
      tituloCilindro: "Escanear cilindro",
      sub: "Apunta a la etiqueta QR",
      seLeeSola: "Se lee sola, sin pulsar",
      linterna: "Encender la linterna",
      apagarLinterna: "Apagar la linterna",
      buscarEnLista: "Elegir en la lista",
      sinPermiso: "Para leer la etiqueta hace falta la c\xE1mara.",
      darPermiso: "Dejar usar la c\xE1mara",
      otroEdificio: "{tag} es de otro edificio, no de esta visita.",
      abrirIgual: "Abrirlo igualmente",
      seguir: "Seguir escaneando",
      desconocidoObra: "Esa etiqueta no es de ning\xFAn equipo de tu obra. B\xFAscalo en la lista.",
      cilindroDesconocido: "Ese cilindro no est\xE1 en tu furgoneta. El\xEDgelo de la lista."
    },
    gravedad: { critica: "Cr\xEDtica", importante: "Importante", menor: "Menor" },
    estadoIncidencia: {
      abierta: "Abierta",
      asignada: "Por corregir",
      corregida: "Corregida",
      verificada: "Verificada",
      cerrada: "Cerrada",
      desestimada: "Desestimada"
    },
    obra: {
      ver: { titulo: "Incidencia", abierta: "Abierta el", fotos: "Fotos", sinFoto: "En este m\xF3vil no est\xE1 la foto: la tiene la oficina." },
      sinObra: "Obra",
      planta: "Planta",
      hoy: "HOY",
      vacio: "Todav\xEDa no tienes ninguna obra en el m\xF3vil. Cuando la oficina te d\xE9 acceso a una, aparecer\xE1 aqu\xED.",
      plantaVacia: "Esta planta no tiene equipos. Elige otra en \xABPlantas\xBB.",
      banda: "{planta} \xB7 {hechos}/{total} equipos revisados",
      incidenciasTuyas: "{n} incidencias tuyas por corregir",
      incidenciasTuyas_1: "1 incidencia tuya por corregir",
      vistaPlantas: "Plantas",
      vistaIncidencias: "Mis incidencias ({n})",
      listaDePlanta: "{planta} \xB7 lista de instalaci\xF3n (L2)",
      equiposRevisados: "{hechos} de {total} equipos revisados",
      irAObra: "Ir a {obra}",
      chip: { hecho: "HECHO", fallos: "{n} FALLO" },
      ficha: {
        vistaLista: "Comprobaci\xF3n",
        vistaPapeles: "Papeles",
        vistaIncidencias: "Incidencias",
        todoCorrecto: "Todo lo que falta, correcto",
        todoHecho: "{n} puntos marcados como correctos",
        correcto: "Correcto",
        mal: "No cumple: abrir incidencia",
        noAplica: "No aplica",
        conFoto: "con foto",
        faltan: "Quedan {n} puntos sin marcar \u2713, \u2717 o N/A: {puntos}",
        terminadoSiguiente: "{tag} revisado. Ahora: {siguiente}",
        terminarPlanta: "Terminar la planta",
        plantaTerminada: "Planta revisada. Quien revisa la obra ya lo ve en su tabla.",
        incidenciaAbierta: "{n} incidencias abiertas; la primera: {texto}",
        incidenciaAbierta_1: "1 incidencia abierta: {texto}",
        leyendaL: "L1 recibido \xB7 L2 lista \xB7 L3 puesta en marcha \xB7 L4 prueba \xB7 L5 sistema",
        queEsL: "\xBFQu\xE9 es?",
        sinIncidencias: "Este equipo no tiene incidencias. Si ves un fallo, m\xE1rcalo con \u2717 en la lista."
      },
      papeles: {
        ficha_tecnica: "Ficha t\xE9cnica",
        declaracion_ce: "Declaraci\xF3n CE",
        manual: "Manual de uso y mantenimiento",
        ficha_pm: "Ficha de puesta en marcha",
        delModelo: "del modelo",
        delEquipo: "de este equipo",
        falta: "FALTA",
        explicacion: "Los papeles del fabricante son del modelo {modelo}: la oficina los reclama una vez y valen para todos sus equipos."
      },
      nueva: {
        titulo: "Nueva incidencia",
        foto: "Foto del fallo",
        repetirFoto: "Repetir foto",
        gravedad: "\xBFC\xF3mo de grave?",
        impideRecibir: "Impide recibir",
        quePasa: "Qu\xE9 pasa (ya escrito; puedes a\xF1adir m\xE1s)",
        noCumple: "No cumple: {punto}",
        dictar: "A\xF1adir detalle (usa el micr\xF3fono del teclado)",
        dictarAyuda: "Toca el micr\xF3fono del teclado y habla",
        responsable: "Responsable: {empresa}. Se avisa al jefe de obra y a quien revisa la obra.",
        abrir: "Abrir incidencia",
        faltaFoto: "Falta la foto",
        faltaGravedad: "Falta la gravedad",
        abierta: "Incidencia abierta con foto. La oficina y quien revisa la obra la ver\xE1n en cuanto haya cobertura."
      },
      incidencias: {
        corregida: "Corregida",
        corregidaHecho: "Marcada como corregida. Falta que la verifique quien revisa la obra.",
        faltaVerificar: "CORREGIDA \xB7 FALTA QUE LA REVISEN",
        foto: "Foto de la correcci\xF3n",
        fotoGuardada: "Foto de la correcci\xF3n guardada",
        vacio: "No tienes incidencias por corregir. Si encuentras un fallo, m\xE1rcalo con \u2717 en la lista del equipo.",
        explicacion: "Al marcarla como corregida, a\xF1ade la foto de la correcci\xF3n. Quien revisa la obra la verifica despu\xE9s."
      }
    },
    mant: {
      vistaRuta: "Ruta de hoy",
      vistaFurgoneta: "Mi furgoneta",
      vistaCertificados: "Mis certificados",
      bandaVisita: "Visita {n}/{total} \xB7 {edificio} \xB7 {hechos}/{equipos} hechos",
      vencidoDesde: "{tag}: control de fugas vencido desde el {fecha}",
      vencidos: "{n} controles de fugas vencidos: {tags}",
      nunca: "primer control",
      sinRuta: "Hoy no tienes visitas en el m\xF3vil. Si la oficina te acaba de asignar una, busca de nuevo con cobertura.",
      visitaVacia: "Esta visita no tiene equipos todav\xEDa. Escanea la etiqueta de uno para darlo de alta.",
      otrasVisitas: "Otras visitas de hoy",
      sinUbicacion: "Sin ubicaci\xF3n",
      sinGas: "Sin gas fluorado",
      cerrarVisitaN: "Cerrar visita y firmar \xB7 {n} de {total} hechos",
      chip: { hecho: "HECHO", vencido: "VENCIDO", venceHoy: "VENCE HOY", fugasIt3: "FUGAS + IT 3", soloIt3: "SOLO IT 3", cerrada: "CERRADA", faltan: "FALTAN {n}", faltaFugas: "FALTA FUGAS", faltaIt3: "FALTA IT 3", sinControl: "SIN CONTROL DE FUGAS", faltaTerminar: "FALTA TERMINAR" },
      furgoneta: {
        carga: "Cilindros de carga",
        recuperacion: "Cilindros de recuperaci\xF3n",
        lote: "Lote {lote}",
        capacidad: "Capacidad {kg} kg",
        vacia: "No hay cilindros en tu furgoneta. P\xEDdelos a la oficina."
      },
      cert: {
        fgas: "Gases fluorados",
        rite: "RITE",
        renovar: "renovar antes del {fecha}",
        caducado: "caducado el {fecha}",
        caducaPronto: "Tu certificado de gases fluorados caduca en {n} d\xEDas",
        sinVigente: "Sin certificado de gases fluorados vigente: no puedes intervenir en equipos con gas",
        ninguno: "No consta ning\xFAn certificado tuyo. P\xEDdele a la oficina que lo a\xF1ada.",
        explicacion: "Si un certificado caduca en menos de 90 d\xEDas, te avisamos aqu\xED arriba y a la oficina."
      },
      ficha: {
        quitar: "Quitar",
        rehacer: "Rehacer",
        confirmarQuitarCarga: "\xBFQuitar esta carga del libro? Los kg vuelven al cilindro.",
        confirmarRehacerControl: "\xBFBorrar este control de fugas para volver a hacerlo?",
        siQuitar: "S\xED, quitarla",
        siRehacer: "S\xED, rehacerlo",
        noQuitar: "No, dejarlo",
        gas: "Gas",
        carga: "Carga",
        controlDeFugas: "Control de fugas",
        cada: "cada {n} meses",
        conDeteccion: "(con detecci\xF3n)",
        proximo: "pr\xF3ximo: {fecha}",
        tocaHoy: "toca HOY",
        vencidoDesde: "VENCIDO desde el {fecha}",
        hechoHoyProximo: "hecho hoy \xB7 pr\xF3ximo: {fecha}",
        exento: "no lo necesita ({t} t CO\u2082e, menos de 5)",
        sinGas: "no lleva gas fluorado",
        noVirgen: "No se puede recargar con {gas} virgen",
        sinCertificado: "Tu certificado no te permite intervenir en este equipo",
        vistaHoy: "Hacer hoy",
        vistaHistorial: "Historial",
        vistaDatos: "Datos",
        bloqueFugas: "Control de fugas",
        bloqueGas: "Gas",
        bloqueIt3: "IT 3 de hoy: {n} operaciones",
        exentoFrase: "Este equipo no necesita control de fugas. Solo las operaciones IT 3.",
        sinGasFrase: "Este equipo no lleva gas fluorado. Solo las operaciones IT 3.",
        sinFuga: "Sin fuga",
        hayFuga: "Hay fuga",
        sinFugaHecho: "SIN FUGA",
        fugaReparadaHecha: "FUGA REPARADA \xB7 {donde}",
        fugaPendienteHecha: "FUGA PENDIENTE \xB7 {donde}",
        fugaHecha: "Fuga: {donde} \xB7 {estado}",
        reparada: "reparada",
        pendiente: "queda pendiente",
        guardadoSinFuga: "Guardado: sin fuga",
        comprobacionProgramada: "Comprobaci\xF3n de la reparaci\xF3n: entre el {desde} y el {hasta}, con el equipo funcionando al menos 24 h.",
        anadidos: "A\xF1adidos {kg} kg de {gas} {origen} \xB7 {cilindro}",
        recuperados: "Recuperados {kg} kg \xB7 {cilindro} \xB7 {motivo}",
        anadirGas: "A\xF1adir gas",
        recuperarGas: "Recuperar gas",
        todasHechas: "Todas hechas",
        unaAUna: "Una a una",
        it3Hechas: "Operaciones IT 3 hechas",
        it3Resumen: "{hechas} de {total} hechas",
        it3SinHacer: "{n} sin hacer",
        it3NoToca: "Hoy no toca ninguna operaci\xF3n IT 3 en este equipo.",
        it3Tabla33: "Instalaci\xF3n de m\xE1s de 70 kW: operaciones y periodicidad de la tabla 3.3 del RITE (IT 3.3).",
        it3Tabla32: "Instalaci\xF3n de 70 kW o menos: periodicidad de la tabla 3.1 del RITE; operaciones seg\xFAn el manual del equipo (tabla 3.2 orientativa).",
        faltaFugas: "Falta el control de fugas: toca \xABSin fuga\xBB o \xABHay fuga\xBB.",
        faltaIt3: "Faltan las operaciones IT 3: toca \xABTodas hechas\xBB o \xABUna a una\xBB.",
        terminadoAhora: "{tag} terminado. Ahora: {siguiente} \xB7 {donde}",
        rutaTerminada: "Has terminado los equipos de este edificio",
        terminarCerrar: "Terminar \xB7 cerrar la visita",
        alLado: "{donde}, al lado",
        deHoy: "de hoy, sin firmar",
        sinHistorial: "A\xFAn no hay nada en el historial de este equipo. Lo que hagas hoy saldr\xE1 aqu\xED.",
        desmontado: "DESMONTADO el {fecha}",
        desmontadoNota: "Equipo dado de baja: ya no admite gas, ni control de fugas, ni operaciones IT 3.",
        bajaRecuperados: "{kg} kg recuperados en {cilindro}",
        confirmarQuitarCargaFuga: "\xBFQuitar esta carga del libro? Los kg vuelven al cilindro y tambi\xE9n se quita la fuga anotada con ella.",
        cargaQuitada: "Carga quitada: {kg} kg vuelven al {cilindro}",
        cargaQuitadaFuga: "Carga quitada: {kg} kg vuelven al {cilindro}. Tambi\xE9n se ha quitado la fuga."
      },
      datos: {
        marcaModelo: "Marca y modelo",
        serie: "N\xFAmero de serie",
        instalado: "Instalado",
        potencia: "Potencia",
        uso: "Uso",
        uso_refrigeracion: "Refrigeraci\xF3n",
        uso_climatizacion: "Aire acondicionado o bomba de calor",
        deteccion: "Detecci\xF3n de fugas",
        hermetico: "Herm\xE9tico",
        pca: "PCA del gas",
        rite: "Certificado RITE anual",
        riteSi: "Entra (m\xE1s de 70 kW)",
        riteEdificio: "Cuenta en la potencia del edificio"
      },
      visitaSinCerrar: "Visita del {fecha} sin cerrar: ci\xE9rrala y firma \xB7 {edificio}",
      cerrarAntigua: "Cerrar la visita del {fecha} y firmar"
    },
    fuga: {
      titulo: "Hay fuga",
      donde: {
        titulo: "1. \xBFD\xF3nde?",
        valvula: "V\xE1lvula de servicio",
        union: "Uni\xF3n o soldadura",
        compresor: "Compresor",
        bateria_interior: "Bater\xEDa interior",
        bateria_exterior: "Bater\xEDa exterior",
        otro: "Otro sitio",
        localizada: "localizada",
        no_localizada: "sin localizar"
      },
      reparada: "2. \xBFEst\xE1 reparada?",
      reparadaAhora: "Reparada ahora",
      quedaPendiente: "Queda pendiente",
      explicacion: "Si la reparas, la app programa sola la comprobaci\xF3n entre 24 horas y 1 mes despu\xE9s.",
      primeroDonde: "Primero toca d\xF3nde estaba la fuga",
      guardadaReparada: "Fuga guardada. Comprobaci\xF3n de la reparaci\xF3n programada.",
      guardadaPendiente: "Fuga guardada. La oficina la ver\xE1 como pendiente."
    },
    gas: {
      titulo: "A\xF1adir gas",
      sub: "{tag} \xB7 lleva {gas} \xB7 {kg} kg",
      elige: "Elige el cilindro (solo salen los de {gas})",
      recomendado: "RECOMENDADO",
      noPermitido: "NO PERMITIDO AQU\xCD",
      quedan: "Quedan {kg} kg \xB7 lote {lote}",
      tocaPorQue: "Quedan {kg} kg \xB7 toca para ver por qu\xE9",
      ninguno: "No llevas ning\xFAn cilindro de {gas} en la furgoneta.",
      pedir: "Pedir {gas} a la oficina",
      escanearCilindro: "Escanear cilindro",
      bandaCilindro: "Cilindro {cilindro} \xB7 {gas} {origen} \xB7 quedan {kg} kg",
      escribe: "Escribe los kg que a\xF1ades",
      porcentaje: "= {p} % de su carga",
      avisoTitular: " \xB7 el titular lo ver\xE1 como aviso",
      guardar: "Guardar carga",
      guardado: "Guardado: {kg} kg de {gas} {origen}",
      borrar: "Borrar",
      avisoOficinaFalta: "Aviso guardado para la oficina: falta un cilindro de {gas}",
      noLlega: "En el {cilindro} solo quedan {kg} kg. Carga {kg} kg y a\xF1ade el resto desde otro cilindro.",
      cargarYOtro: "Cargar {kg} kg y elegir otro cilindro",
      parcial: "Guardados {kg} kg del {cilindro}. Faltan {resto} kg: elige otro cilindro."
    },
    prohibida: {
      volver: "\u2190 Elegir otro cilindro",
      titulo: "No cargues este gas",
      tituloOtroGas: "Este cilindro no vale",
      frase: "{tag} es un equipo de {uso} con {gas}.",
      uso_refrigeracion: "refrigeraci\xF3n",
      uso_climatizacion: "climatizaci\xF3n",
      otroGas: "El cilindro {cilindro} es de {gasCilindro} y el equipo lleva {gas}. No se pueden mezclar gases.",
      loQuePuedes: "Lo que puedes hacer:",
      usar: "Usar el {cilindro} de {gas} {origen} (quedan {kg} kg)",
      avisar: "No cargar y avisar a la oficina",
      avisado: "Aviso guardado para la oficina: {tag} necesita gas reciclado o regenerado, o cambiar el gas o el equipo",
      ley: "Lo dice el {citas}."
    },
    pregunta: {
      titulo: "Una pregunta",
      texto: "Si ha hecho falta gas, hay una fuga. \xBFLa has encontrado?",
      explicacion: "Lo pide el libro del equipo. Si no la encuentras, avisamos a la oficina para volver.",
      reparada: "S\xED, y est\xE1 reparada",
      pendiente: "S\xED, pero queda pendiente",
      noLocalizada: "No la encuentro",
      avisada: "Avisada la oficina: fuga sin localizar",
      corregirKg: "Corregir los kg"
    },
    recuperar: {
      titulo: "Recuperar gas",
      sinCilindro: "No llevas cilindro de recuperaci\xF3n de {gas}. No lo mezcles con otro gas: luego no se puede regenerar.",
      pedir: "Pedir uno a la oficina",
      avisado: "Aviso guardado para la oficina: falta un cilindro de recuperaci\xF3n de {gas}",
      bandaCilindro: "Cilindro {cilindro} \xB7 {gas} \xB7 lleva {kg} de {cap} kg",
      motivo: "\xBFPara qu\xE9?",
      paraReparar: "Para reparar",
      desmontaje: "Desmontaje",
      para_reparar: "para reparar",
      desmontajeTexto: "desmontaje",
      desmontajeNota: "Si el equipo se retira, recupera primero todo el gas y luego toca \xABDesmontar el equipo\xBB.",
      guardado: "Guardado: {kg} kg recuperados",
      desmontaje_min: "desmontaje",
      guardarReparar: "Guardar \xB7 el equipo se queda",
      faltanKg: "Escribe los kg que recuperas",
      desmontar: "Desmontar el equipo",
      confirmarBaja: "\xBFDar de baja {tag}? Sale de la ruta y ya no admite gas. No tiene vuelta.",
      siBaja: "S\xED, dar de baja",
      dadoDeBaja: "{tag} dado de baja \xB7 {kg} kg recuperados en {cilindro}"
    },
    it3: {
      titulo: "Operaciones IT 3",
      sub: "{tag} \xB7 tocan hoy {n}",
      hecha: "HECHA",
      noHecha: "NO HECHA",
      periodicidad: "Periodicidad: {p}",
      tocaMotivo: "toca el motivo",
      motivo: { no_accesible: "No accesible", equipo_parado: "Equipo parado", otro: "Otro" },
      nota: "Marca las que has hecho hoy. Salen solo las que tocan hoy seg\xFAn el tipo de equipo y su potencia.",
      listo: "Guardar",
      botonHecha: "\u2713 Hecha",
      botonNoHecha: "No hecha",
      guardarN: "Guardar \xB7 {h} de {n} hechas",
      faltaMarcar: "Marca cada operaci\xF3n: hecha o no hecha",
      faltaMotivo: "Toca el motivo de la que no has hecho",
      periodo: { m: "mensual", t: "una por temporada", "2t": "dos por temporada" },
      cadaMeses: "cada {n} meses"
    },
    cerrar: {
      titulo: "Cerrar visita",
      sinEdificio: "No hay ning\xFAn edificio elegido. La visita se cierra desde la ruta de hoy: elige all\xED el edificio y toca \xABCerrar visita\xBB.",
      irAHoy: "Ir a la ruta de hoy",
      hechos: "{hechos} de {total} equipos hechos",
      quedan: "Quedan {n} sin hacer: {tags}. Pasar\xE1n a otro d\xEDa.",
      tecnico: "T\xE9cnico",
      firmarComo: "Firmar como {nombre}",
      firmaGuardada: "Firmado \xB7 {cert}",
      firmarPrimera: "Firma una vez con el dedo: la guardamos para las pr\xF3ximas visitas.",
      cliente: "Cliente",
      firmeAqui: "Firme aqu\xED con el dedo",
      borrar: "Borrar",
      noEsta: "No est\xE1: enviar enlace",
      enlace: "Se le enviar\xE1 un enlace para firmar",
      quitar: "Quitar",
      nombreCliente: "Nombre de quien firma",
      cerrar: "Cerrar visita",
      confirmar: "S\xED, cerrar la visita (no tiene vuelta)",
      faltaTecnico: "Falta tu firma",
      faltaCliente: "Falta la firma del cliente o el enlace",
      faltaEquipos: "Termina al menos un equipo",
      sinFuga: "sin fuga",
      fuga: "fuga {estado}",
      noObligatorio: "fugas: no obligatorio",
      mas: "+{kg} kg",
      menos: "\u2212{kg} kg recuperados",
      it3: "IT 3 {hechas}/{total}",
      tituloDia: "Cerrar la visita del {fecha}",
      antiguaCerrada: "Visita del {fecha} cerrada y firmada"
    },
    fin: {
      titulo: "Visita cerrada",
      hecho: "{n} equipos anotados en su libro. El parte {envio} al cliente y a la oficina.",
      hecho_1: "1 equipo anotado en su libro. El parte {envio} al cliente y a la oficina.",
      enviado: "se ha enviado",
      seEnviara: "se enviar\xE1 cuando haya cobertura",
      siguiente: "Siguiente visita",
      ir: "Ir a la siguiente visita",
      terminado: "Has terminado las visitas de hoy.",
      volver: "Volver a la ruta",
      equipos: "{n} equipos"
    },
    alta: {
      titulo: "Equipo nuevo",
      sub: "Etiqueta nueva: dar de alta",
      fotoPlaca: "Foto de la placa de caracter\xEDsticas",
      hacerFoto: "Hacer foto de la placa",
      sinFoto: "Seguir sin foto",
      ocrPendiente: "La placa todav\xEDa no se lee sola. La foto se guarda y la oficina completar\xE1 marca, modelo y serie.",
      tag: "TAG (el de la etiqueta)",
      tipo: "Tipo de equipo",
      marca: "Marca",
      modelo: "Modelo",
      serie: "N\xFAmero de serie",
      gasTitulo: "Gas",
      sinGas: "Sin gas",
      cargaFabrica: "Carga de f\xE1brica (kg)",
      potencia: "Potencia de fr\xEDo (kW)",
      donde: "\xBFD\xF3nde est\xE1?",
      anadido: "Gas a\xF1adido al instalar",
      nada: "Nada",
      seguir: "Seguir",
      decidido: "Lo que la app ha decidido",
      tco2e: "{tag} \xB7 {gas} \xB7 {kg} kg \xB7 {t} t CO\u2082e",
      fugasCada: "Control de fugas cada {n} meses.",
      fugasNo: "Control de fugas: no obligatorio.",
      it3: "Mantenimiento RITE: {texto}",
      recargaSi: "Recarga con gas virgen: permitida.",
      recargaNo: "Recarga con gas virgen: prohibida.",
      anexo: "La oficina tiene que comunicar este equipo a Industria; se lo apuntamos.",
      guardar: "Guardar equipo",
      guardado: "{tag} dado de alta",
      faltaTag: "Falta el TAG",
      tipos: { split: "Split", vrf: "VRF", enfriadora: "Enfriadora", rooftop: "Rooftop", camara_frigorifica: "C\xE1mara frigor\xEDfica", bomba_calor_aire_agua: "Bomba de calor", compacto: "Compacto", otro: "Otro" },
      tagLeido: "TAG (le\xEDdo en la etiqueta)",
      corregir: "Corregir",
      mirarGas: "Mira el gas en la placa: de \xE9l depende si hace falta control de fugas.",
      faltaGas: "Falta el gas",
      faltaTipo: "Falta el tipo de equipo",
      faltaCarga: "Falta la carga de la placa",
      masDatos: "A\xF1adir marca, modelo y serie (si quieres)",
      opcional: "si quieres",
      escribeCarga: "Escribe la carga que pone la placa",
      potenciaAyuda: "Potencia de fr\xEDo de la placa, si la pone",
      resumen: "{t} t CO\u2082e \xB7 {fugas}",
      anexoNorma: "Anexo VI parte B del RD 115/2017",
      deshecha: "Alta deshecha: el equipo no se ha guardado",
      noDeshacer: "Ya se ha enviado: pide a la oficina que lo quite"
    },
    origen: { virgen: "virgen", regenerado: "regenerado", reciclado: "reciclado" },
    intervencion: {
      control_fugas: "Control de fugas",
      carga: "Carga de gas",
      recuperacion: "Recuperaci\xF3n de gas",
      reparacion: "Reparaci\xF3n",
      puesta_en_marcha: "Puesta en marcha",
      desmantelamiento: "Equipo dado de baja",
      comprobacion_deteccion: "Comprobaci\xF3n de la detecci\xF3n",
      it3: "Operaci\xF3n IT 3"
    },
    resultado: {
      sin_fugas: "Sin fuga",
      fuga_detectada: "Fuga pendiente",
      fuga_reparada: "Fuga reparada",
      no_aplica: "No aplica",
      correcto: "Correcta",
      corregido: "Corregida",
      defecto: "Con defecto"
    },
    punto: {
      fancoil: {
        soportes: "Soportes y antivibratorios",
        valvulas_corte: "Conexiones de agua con v\xE1lvulas de corte",
        aislamiento: "Aislamiento de tuber\xEDas y v\xE1lvulas",
        sifon_cargado: "Sif\xF3n de condensados CARGADO",
        filtro_sin_bypass: "Filtro colocado, sin bypass",
        electrica: "Conexi\xF3n el\xE9ctrica y protecci\xF3n"
      },
      split: {
        soportes: "Soportes y antivibratorios",
        tuberia_aislada: "Tuber\xEDa frigor\xEDfica aislada y sujeta",
        prueba_nitrogeno: "Prueba con nitr\xF3geno anotada",
        vacio: "Vac\xEDo hecho y anotado",
        desague: "Desag\xFCe con pendiente",
        etiqueta_tag: "Etiqueta con el TAG visible"
      },
      uta: {
        soportes: "Soportes y antivibratorios",
        filtros: "Filtros asentados, sin bypass",
        correas: "Correas tensadas",
        sifon_cargado: "Sifones de condensados CARGADOS",
        sentido_giro: "Sentido de giro",
        consumo_placa: "Consumo por fase contrastado con la placa",
        compuertas: "Compuertas libres y en posici\xF3n"
      },
      enfriadora: {
        bancada: "Bancada y antivibratorios",
        conexiones_hidraulicas: "Conexiones hidr\xE1ulicas",
        valvulas_corte: "V\xE1lvulas de corte y filtros",
        electrica: "Conexi\xF3n el\xE9ctrica y protecci\xF3n",
        espacio_servicio: "Espacio de servicio libre",
        estanqueidad: "Circuito frigor\xEDfico sin fugas"
      },
      bomba: { bancada: "Bancada y antivibratorios", valvulas_corte: "V\xE1lvulas de corte", manometros: "Man\xF3metros colocados", electrica: "Conexi\xF3n el\xE9ctrica y protecci\xF3n", sentido_giro: "Sentido de giro" },
      ventilador: { soportes: "Soportes y antivibratorios", conducto: "Uni\xF3n al conducto", electrica: "Conexi\xF3n el\xE9ctrica y protecci\xF3n", sentido_giro: "Sentido de giro" },
      general: { soportes: "Soportes y fijaciones", conexiones: "Conexiones", electrica: "Conexi\xF3n el\xE9ctrica y protecci\xF3n", etiqueta_tag: "Etiqueta con el TAG visible" }
    }
  };

  // cxobra/mantenimiento/fuente/datos/sincronizacion.ts
  var ErrorServidor = class extends Error {
    codigo;
    constructor(codigo, mensaje) {
      super(mensaje);
      this.codigo = codigo;
    }
    /**
     * Sin red o el servidor no contesta: se reintenta más tarde. En Vidaire Cx,
     * también si la sesión caducó a mitad (nube-vidaire.ts): no es culpa del
     * cambio, así que no se rechaza; sube al volver a entrar.
     */
    get esDeRed() {
      return this.codigo === "red" || this.codigo === "sin_sesion" || /^5\d\d$/.test(this.codigo);
    }
  };
  async function subir(base2, servidor, leerFichero2) {
    const r = { subidos: 0, rechazados: 0, conflictos: 0, sinRed: false };
    const cola = await base2.todas(`select * from cola where estado = 'pendiente' order by n`);
    for (const e of cola) {
      await base2.ejecutar("update cola set intentos = intentos + 1, ultimo_intento = ? where n = ?", [ahoraISO(), e.n]);
      try {
        if (e.tipo === "fila") r.conflictos += await subirFila(base2, servidor, e);
        else if (e.tipo === "intervencion") await subirIntervencion(base2, servidor, e.fila_id);
        else await subirFichero(base2, servidor, e.fila_id, leerFichero2);
        await base2.ejecutar("delete from cola where n = ?", [e.n]);
        r.subidos++;
      } catch (err) {
        const x = err instanceof ErrorServidor ? err : new ErrorServidor("red", String(err?.message ?? err));
        if (x.esDeRed) {
          await base2.ejecutar("update cola set mensaje = ? where n = ?", [x.message, e.n]);
          r.sinRed = true;
          break;
        }
        await base2.ejecutar(`update cola set estado = 'rechazado', mensaje = ? where n = ?`, [`${x.codigo}: ${x.message}`, e.n]);
        r.rechazados++;
      }
    }
    return r;
  }
  async function subirFila(base2, servidor, e) {
    const t = TABLAS_ESPEJO.get(e.tabla);
    const cambios = JSON.parse(e.cambios);
    if (e.operacion === "upsert" || e.version_leida === null) {
      const local = await base2.una(`select * from ${e.tabla} where id = ?`, [e.fila_id]);
      const fila2 = aServidor(t, local ?? { id: e.fila_id, ...cambios });
      const v = await servidor.upsert(e.tabla, fila2);
      await base2.ejecutar(`update ${e.tabla} set version = ?, actualizado_en = ? where id = ?`, [v.version, v.actualizado_en, e.fila_id]);
      return 0;
    }
    const paraServidor = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, valorServidor(t, k, v)]));
    try {
      const v = await servidor.actualizar(e.tabla, e.fila_id, paraServidor(cambios), e.version_leida);
      await base2.ejecutar(`update ${e.tabla} set version = ?, actualizado_en = ? where id = ?`, [v.version, v.actualizado_en, e.fila_id]);
      return 0;
    } catch (err) {
      if (!(err instanceof ErrorServidor) || err.codigo !== "PT409") throw err;
      return rebasar(base2, servidor, t, e, cambios);
    }
  }
  async function rebasar(base2, servidor, t, e, cambios) {
    const remota = await servidor.leer(e.tabla, e.fila_id);
    if (!remota) throw new ErrorServidor("PT404", "La fila ya no existe en el servidor.");
    const antes = JSON.parse(e.antes ?? "{}");
    const remotaLocal = aLocal(t, remota);
    const valorRemoto = (c) => remotaLocal[t.columnas.indexOf(c) + 1] ?? null;
    const quedan = {};
    let conflictos = 0;
    for (const [campo, mio] of Object.entries(cambios)) {
      const suyo = valorRemoto(campo);
      if (igual(suyo, mio)) continue;
      if (igual(suyo, antes[campo] ?? null)) {
        quedan[campo] = mio;
        continue;
      }
      conflictos++;
      await base2.ejecutar(
        "insert into conflictos (id, tabla, fila_id, campo, mio, servidor, creado_en) values (?, ?, ?, ?, ?, ?, ?)",
        [uuidv7(), e.tabla, e.fila_id, campo, texto(mio), texto(suyo), ahoraISO()]
      );
    }
    await base2.ejecutar(sqlUpsertEspejo(t), remotaLocal);
    if (Object.keys(quedan).length) {
      const cols = Object.keys(quedan);
      await base2.ejecutar(`update ${e.tabla} set ${cols.map((c) => `${c} = ?`).join(", ")} where id = ?`, [...cols.map((c) => quedan[c] ?? null), e.fila_id]);
      const v = await servidor.actualizar(
        e.tabla,
        e.fila_id,
        Object.fromEntries(cols.map((c) => [c, valorServidor(t, c, quedan[c])])),
        Number(remota.version)
      );
      await base2.ejecutar(`update ${e.tabla} set version = ?, actualizado_en = ? where id = ?`, [v.version, v.actualizado_en, e.fila_id]);
    }
    return conflictos;
  }
  async function cargaIntervencion(base2, id) {
    const i = await base2.una("select * from intervenciones where id = ?", [id]);
    if (!i) throw new ErrorServidor("PT404", "La intervenci\xF3n ya no est\xE1 en el m\xF3vil.");
    const movimientos = await base2.todas("select * from movimientos_gas where intervencion_id = ? and borrado_en is null", [id]);
    const documentos = await base2.todas("select * from documentos where intervencion_id = ? and borrado_en is null", [id]);
    return {
      id: i.id,
      equipo_id: i.equipo_id,
      contrato_id: i.contrato_id,
      tecnico_id: i.tecnico_id,
      tipo: i.tipo,
      realizada_en: i.realizada_en,
      resultado: i.resultado,
      observaciones: i.observaciones,
      firmante_cliente_nombre: i.firmante_cliente_nombre,
      firmante_cliente_cargo: i.firmante_cliente_cargo,
      anula_a_id: i.anula_a_id,
      cliente_modificado_en: ahoraISO(),
      estado: i.estado,
      movimientos: movimientos.map((m) => ({ id: m.id, sentido: m.sentido, refrigerante: m.refrigerante, kg: m.kg, origen: m.origen, lugar_tratamiento: m.lugar_tratamiento, cilindro: m.cilindro, lote: m.lote })),
      documentos: documentos.map((d) => ({ id: d.id, tipo: d.tipo, titulo: d.titulo, ruta: d.ruta, mime: d.mime, bytes: d.bytes, sha256: d.sha256 }))
    };
  }
  async function subirIntervencion(base2, servidor, id) {
    await servidor.subirIntervencion(await cargaIntervencion(base2, id));
    await base2.ejecutar("update intervenciones set version = max(version, 1) where id = ?", [id]);
    await base2.ejecutar("update movimientos_gas set version = max(version, 1) where intervencion_id = ?", [id]);
    await base2.ejecutar("update documentos set version = max(version, 1) where intervencion_id = ?", [id]);
  }
  async function subirFichero(base2, servidor, documentoId, leer2) {
    const f = await base2.una("select * from ficheros where documento_id = ?", [documentoId]);
    if (!f || f.subido) return;
    const d = await base2.una("select ruta from documentos where id = ?", [documentoId]);
    if (!d) throw new ErrorServidor("PT404", "El documento del fichero ya no est\xE1 en el m\xF3vil.");
    await servidor.subirFichero(d.ruta, await leer2(f), f.mime);
    await base2.ejecutar("update ficheros set subido = 1 where documento_id = ?", [documentoId]);
  }
  var SOLAPE_MS = 5 * 60 * 1e3;
  var PAGINA = 500;
  async function bajar(base2, servidor, usuarioId, hoy) {
    let filas = 0;
    for (const t of ESPEJO.filter((x) => x.alcance.tipo === "global" || x.alcance.tipo === "hijo" && x.alcance.padre === "plantillas_prueba")) {
      filas += await bajarTabla(base2, servidor, t, usuarioId, void 0, hoy);
    }
    const edificios = await servidor.edificiosDeTrabajo(usuarioId);
    const antes = JSON.parse(await leerAjuste(base2, "edificios") ?? "[]");
    for (const fuera of antes.filter((x) => !edificios.includes(x))) await olvidarEdificio(base2, fuera);
    for (const ed of edificios) {
      for (const t of ESPEJO.filter((x) => x.alcance.tipo === "edificio" || x.alcance.tipo === "hijo" && x.alcance.padre !== "plantillas_prueba")) {
        filas += await bajarTabla(base2, servidor, t, usuarioId, ed, hoy);
      }
    }
    await guardarAjuste(base2, "edificios", JSON.stringify(edificios));
    await guardarAjuste(base2, "ultima_bajada", ahoraISO());
    return { filas, edificios };
  }
  async function bajarTabla(base2, servidor, t, usuarioId, edificio, hoy) {
    const clave = `cursor:${t.nombre}${edificio ? `:${edificio}` : ""}`;
    const cursor = await leerAjuste(base2, clave);
    const desde2 = cursor ? new Date(Date.parse(cursor) - SOLAPE_MS).toISOString() : null;
    const fechaMinima = t.alcance.tipo === "edificio" && t.alcance.desdeMeses ? restarMeses(hoy, t.alcance.desdeMeses) : void 0;
    let total = 0;
    let marca = desde2;
    let maximo = cursor;
    for (; ; ) {
      const lote = await servidor.bajar(t, { desde: marca, edificio, usuarioId, limite: PAGINA, fechaMinima });
      for (const fila2 of lote) {
        if (await aplicarFila(base2, t, fila2)) total++;
        const a = fila2.actualizado_en;
        if (a && (!maximo || a > maximo)) maximo = a;
      }
      if (lote.length < PAGINA) break;
      const ultimo = lote[lote.length - 1].actualizado_en;
      if (ultimo === marca) break;
      marca = ultimo;
    }
    if (maximo) await guardarAjuste(base2, clave, maximo);
    return total;
  }
  async function aplicarFila(base2, t, fila2) {
    const id = String(fila2.id);
    const pendiente = await base2.una(`select n from cola where tabla = ? and fila_id = ? and estado = 'pendiente'`, [t.nombre, id]);
    if (pendiente) return false;
    const local = await base2.una(`select version from ${t.nombre} where id = ?`, [id]);
    if (local && local.version === Number(fila2.version)) return false;
    if (fila2.borrado_en) {
      await base2.ejecutar(`delete from ${t.nombre} where id = ?`, [id]);
      return true;
    }
    await base2.ejecutar(sqlUpsertEspejo(t), aLocal(t, fila2));
    return true;
  }
  async function olvidarEdificio(base2, edificio) {
    const pend = `not exists (select 1 from cola c where c.fila_id = %T.id and c.estado = 'pendiente')`;
    await base2.transaccion(async () => {
      for (const t of ESPEJO) {
        if (t.alcance.tipo === "hijo" && t.alcance.padre !== "plantillas_prueba") {
          await base2.ejecutar(`delete from ${t.nombre} where ${t.alcance.fk} in (select id from ${t.alcance.padre} where edificio_id = ?) and ${pend.replace("%T", t.nombre)}`, [edificio]);
        }
      }
      for (const t of ESPEJO) {
        if (t.alcance.tipo === "edificio") {
          await base2.ejecutar(`delete from ${t.nombre} where ${t.alcance.columna} = ? and ${pend.replace("%T", t.nombre)}`, [edificio]);
          await base2.ejecutar("delete from ajustes where clave = ?", [`cursor:${t.nombre}:${edificio}`]);
        }
        if (t.alcance.tipo === "hijo") await base2.ejecutar("delete from ajustes where clave = ?", [`cursor:${t.nombre}:${edificio}`]);
      }
    });
  }
  function igual(a, b) {
    if (a === null || a === void 0) return b === null || b === void 0;
    return String(a) === String(b);
  }
  function texto(v) {
    return v === null || v === void 0 ? null : String(v);
  }
  function restarMeses(fecha, meses) {
    const [a, m, d] = fecha.split("-").map(Number);
    const total = a * 12 + (m - 1) - meses;
    return `${Math.floor(total / 12)}-${String(total % 12 + 1).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`;
  }

  // cxobra/mantenimiento/fuente/datos/nube-vidaire.ts
  function fallo(status, cuerpo, texto2) {
    const c = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
    const mensaje = String(c.message ?? c.msg ?? c.error_description ?? c.error ?? texto2 ?? "Sin mensaje");
    const codigo = typeof c.code === "string" && c.code ? c.code : "";
    if (/^PT\d\d\d$/.test(codigo)) return new ErrorServidor(codigo, mensaje);
    if (status >= 500) return new ErrorServidor(String(status), mensaje);
    return new ErrorServidor(codigo || String(status), mensaje);
  }
  function crearNube(cfg) {
    const base2 = cfg.url.replace(/\/+$/, "");
    const pedirRed = cfg.fetch ?? ((...a) => globalThis.fetch(...a));
    const ahora3 = cfg.ahora ?? (() => Math.floor(Date.now() / 1e3));
    let sesion = cfg.sesion ?? null;
    let renovando = null;
    const poner = (s) => {
      sesion = s;
      cfg.alCambiarSesion?.(s);
    };
    async function bruto(ruta, p = {}) {
      const cab = { apikey: cfg.clave, ...p.cabeceras };
      if (!p.sinSesion && sesion) cab.Authorization = `Bearer ${sesion.token}`;
      let body;
      if (p.bytes) {
        body = p.bytes;
        cab["Content-Type"] = p.mime ?? "application/octet-stream";
      } else if (p.cuerpo !== void 0) {
        body = JSON.stringify(p.cuerpo);
        cab["Content-Type"] = "application/json";
      }
      let r;
      try {
        r = await pedirRed(`${base2}${ruta}`, { method: p.metodo ?? "GET", headers: cab, body });
      } catch (e) {
        throw new ErrorServidor("red", e?.message || "Sin conexi\xF3n");
      }
      const texto2 = await r.text().catch(() => "");
      let cuerpo = null;
      try {
        cuerpo = texto2 ? JSON.parse(texto2) : null;
      } catch {
        cuerpo = null;
      }
      return { status: r.status, cuerpo, texto: texto2 };
    }
    function aSesion(c, correo) {
      const u = c.user ?? {};
      const caduca = Number(c.expires_at) || ahora3() + Number(c.expires_in ?? 3600);
      return { token: String(c.access_token), renovar: String(c.refresh_token), caduca, usuarioId: String(u.id ?? sesion?.usuarioId ?? ""), correo: String(u.email ?? correo) };
    }
    async function renovar() {
      if (!sesion) throw new ErrorServidor("sin_sesion", "No has entrado en Vidaire.");
      if (!renovando) {
        const actual = sesion;
        renovando = (async () => {
          const r = await bruto("/auth/v1/token?grant_type=refresh_token", { metodo: "POST", cuerpo: { refresh_token: actual.renovar }, sinSesion: true });
          if (r.status >= 200 && r.status < 300 && r.cuerpo) {
            poner(aSesion(r.cuerpo, actual.correo));
            return;
          }
          const e = fallo(r.status, r.cuerpo, r.texto);
          if (!e.esDeRed) {
            poner(null);
            throw new ErrorServidor("sin_sesion", "La sesi\xF3n de Vidaire ha caducado: vuelve a entrar.");
          }
          throw e;
        })().finally(() => {
          renovando = null;
        });
      }
      return renovando;
    }
    async function pedir(ruta, p = {}) {
      if (!sesion) throw new ErrorServidor("sin_sesion", "No has entrado en Vidaire.");
      if (sesion.caduca - 60 <= ahora3()) await renovar();
      let r = await bruto(ruta, p);
      if (r.status === 401 || r.cuerpo?.code === "PGRST301") {
        await renovar();
        r = await bruto(ruta, p);
      }
      if (r.status >= 200 && r.status < 300) return r.cuerpo;
      throw fallo(r.status, r.cuerpo, r.texto);
    }
    async function entrar(correo, clave) {
      const r = await bruto("/auth/v1/token?grant_type=password", { metodo: "POST", cuerpo: { email: correo.trim(), password: clave }, sinSesion: true });
      if (r.status >= 200 && r.status < 300 && r.cuerpo) {
        const s = aSesion(r.cuerpo, correo.trim());
        poner(s);
        return s;
      }
      const e = fallo(r.status, r.cuerpo, r.texto);
      if (e.esDeRed) throw e;
      const c = r.cuerpo ?? {};
      if (c.error_code === "invalid_credentials" || c.error === "invalid_grant" || r.status === 400) throw new ErrorServidor("credenciales", "El correo o la contrase\xF1a no son correctos.");
      if (c.error_code === "email_not_confirmed") throw new ErrorServidor("sin_confirmar", "A\xFAn no has confirmado tu correo: mira el enlace que te mand\xF3 Vidaire.");
      throw e;
    }
    async function salir() {
      const s = sesion;
      poner(null);
      if (!s) return;
      try {
        await pedirRed(`${base2}/auth/v1/logout`, { method: "POST", headers: { apikey: cfg.clave, Authorization: `Bearer ${s.token}` } });
      } catch {
      }
    }
    const q = encodeURIComponent;
    const lista = (xs) => `(${xs.map((x) => /[,()"\s]/.test(x) ? `"${x.replace(/"/g, '\\"')}"` : x).join(",")})`;
    const una = (d) => Array.isArray(d) ? d[0] ?? null : d;
    const VERSION = "select=version,actualizado_en";
    const servidor = {
      async bajar(t, c) {
        const cols = ["id", ...t.columnas, "version", "actualizado_en", "borrado_en"].join(",");
        const a = t.alcance;
        const sel = a.tipo === "hijo" ? `${cols},${a.padre}!inner(${a.padre === "plantillas_prueba" ? "estado" : "edificio_id"})` : cols;
        const f = [`select=${q(sel)}`, "order=actualizado_en.asc,id.asc", `limit=${c.limite}`];
        if (c.desde) f.push(`actualizado_en=gt.${q(c.desde)}`);
        if (a.tipo === "global") {
          if (a.filtro === "usuario") f.push(`${t.nombre === "perfiles" ? "id" : "usuario_id"}=eq.${q(c.usuarioId)}`);
          if (a.filtro === "tecnico") f.push(`tecnico_id=eq.${q(c.usuarioId)}`);
          if (a.filtro === "publicadas") f.push(`estado=in.${q(lista(["publicada", "retirada"]))}`);
        } else if (a.tipo === "edificio") {
          f.push(`${a.columna}=eq.${q(c.edificio)}`);
          if (c.fechaMinima && a.columnaFecha) f.push(`${a.columnaFecha}=gte.${q(c.fechaMinima)}`);
        } else if (a.padre === "plantillas_prueba") {
          f.push(`${a.padre}.estado=in.${q(lista(["publicada", "retirada"]))}`);
        } else {
          f.push(`${a.padre}.edificio_id=eq.${q(c.edificio)}`);
        }
        const filas = await pedir(`/rest/v1/${t.nombre}?${f.join("&")}`) ?? [];
        return filas.map((x) => {
          if (a.tipo === "hijo") delete x[a.padre];
          return x;
        });
      },
      async upsert(tabla2, fila2) {
        const d = una(await pedir(`/rest/v1/${tabla2}?${VERSION}`, { metodo: "POST", cuerpo: fila2, cabeceras: { Prefer: "resolution=merge-duplicates,return=representation" } }));
        if (!d) throw new ErrorServidor("PT403", "No tienes permiso para guardar esta fila.");
        return d;
      },
      async actualizar(tabla2, id, cambios, version) {
        const d = una(await pedir(`/rest/v1/${tabla2}?id=eq.${q(id)}&${VERSION}`, { metodo: "PATCH", cuerpo: { ...cambios, version }, cabeceras: { Prefer: "return=representation" } }));
        if (!d) throw new ErrorServidor("PT403", "No tienes permiso para cambiar esta fila o ya no la ves.");
        return d;
      },
      async leer(tabla2, id) {
        return una(await pedir(`/rest/v1/${tabla2}?select=*&id=eq.${q(id)}`));
      },
      async subirIntervencion(p) {
        await pedir("/rest/v1/rpc/subir_intervencion", { metodo: "POST", cuerpo: { p } });
      },
      async subirFichero(ruta, datos, mime) {
        try {
          await pedir(`/storage/v1/object/registro/${ruta.split("/").map(q).join("/")}`, { metodo: "POST", bytes: datos, mime, cabeceras: { "x-upsert": "false" } });
        } catch (e) {
          const x = e;
          if (x.codigo === "409" || /already exists|Duplicate/i.test(x.message)) return;
          throw e;
        }
      },
      async edificiosDeTrabajo(usuarioId) {
        const ruta = await pedir("/rest/v1/rpc/sync_ruta", { metodo: "POST", cuerpo: {} }) ?? [];
        const ids = new Set(ruta.map((x) => typeof x === "string" ? x : x.sync_ruta));
        const mias = await pedir(`/rest/v1/miembros?select=organizacion_id&usuario_id=eq.${q(usuarioId)}&activo=eq.true`) ?? [];
        const orgs = mias.map((m) => m.organizacion_id);
        if (orgs.length) {
          const obras = await pedir(`/rest/v1/proyecto_participantes?select=${q("proyectos_cx!inner(edificio_id)")}&organizacion_id=in.${q(lista(orgs))}&estado=eq.vigente`) ?? [];
          for (const o of obras) {
            for (const x of Array.isArray(o.proyectos_cx) ? o.proyectos_cx : [o.proyectos_cx]) ids.add(x.edificio_id);
          }
        }
        return [...ids];
      }
    };
    return { entrar, salir, renovar, pedir, servidor, sesion: () => sesion };
  }

  // cxobra/mantenimiento/fuente/datos/cuenta.ts
  async function deducirIdentidad(base2, usuarioId, correo) {
    const perfil = await base2.una("select nombre_completo from perfiles where id = ?", [usuarioId]);
    const orgs = await base2.todas(
      `select o.id, o.tipos from organizaciones o join miembros m on m.organizacion_id = o.id where m.usuario_id = ? and coalesce(m.activo, 1) = 1 order by o.nombre`,
      [usuarioId]
    );
    const mant = orgs.find((o) => o.tipos?.includes("mantenedora")) ?? orgs[0];
    return { usuarioId, nombre: perfil?.nombre_completo || correo, organizacionId: mant?.id ?? "", correo };
  }
  function crearCuenta(o) {
    let identidad = null;
    let sincronizando = null;
    let ultima = null;
    let sinRed = false;
    let error = null;
    const laBase = () => {
      const b = o.base();
      if (!b) throw new Error("El modo Mantenimiento a\xFAn no est\xE1 abierto.");
      return b;
    };
    async function estado() {
      const b = o.base();
      const p = b ? await pendientes(b) : { porEnviar: 0, rechazados: 0 };
      const c = b ? await b.una("select count(*) as n from conflictos") : null;
      const s = o.nube.sesion();
      return { conectado: Boolean(s), correo: s?.correo ?? null, sincronizando: Boolean(sincronizando), ultima, sinRed, error, ...p, conflictos: c?.n ?? 0 };
    }
    async function avisar(r) {
      if (o.alCambiar) o.alCambiar(await estado(), r);
    }
    async function recuperar() {
      const s = o.nube.sesion();
      if (!s) {
        identidad = null;
        return null;
      }
      const b = laBase();
      const usuario = await leerAjuste(b, "usuario");
      if (usuario !== s.usuarioId) {
        identidad = null;
        return null;
      }
      ultima = await leerAjuste(b, "ultima_vuelta");
      identidad = await deducirIdentidad(b, s.usuarioId, s.correo);
      return identidad;
    }
    function sincronizar() {
      if (sincronizando) return sincronizando;
      const s = o.nube.sesion();
      const b = o.base();
      if (!s || !b) return Promise.resolve(null);
      sincronizando = (async () => {
        void avisar();
        const r = { subidos: 0, rechazados: 0, conflictos: 0, filas: 0, sinRed: false };
        try {
          const sub = await subir(b, o.nube.servidor, o.leerFichero);
          Object.assign(r, { subidos: sub.subidos, rechazados: sub.rechazados, conflictos: sub.conflictos, sinRed: sub.sinRed });
          if (!sub.sinRed) {
            const baj = await bajar(b, o.nube.servidor, s.usuarioId, o.hoy());
            r.filas = baj.filas;
            ultima = (/* @__PURE__ */ new Date()).toISOString();
            await guardarAjuste(b, "ultima_vuelta", ultima);
          }
          sinRed = r.sinRed;
          error = !o.nube.sesion() ? "La sesi\xF3n de Vidaire ha caducado: vuelve a entrar." : null;
          identidad = await deducirIdentidad(b, s.usuarioId, s.correo);
        } catch (e) {
          const x = e;
          sinRed = Boolean(x.esDeRed);
          r.sinRed = sinRed;
          error = sinRed && x.codigo !== "sin_sesion" ? null : x.message;
        }
        return r;
      })().finally(() => {
        sincronizando = null;
      });
      return sincronizando.then(async (r) => {
        await avisar(r ?? void 0);
        return r;
      });
    }
    async function entrar(correo, clave) {
      const b = laBase();
      const anterior = await leerAjuste(b, "usuario");
      const s = await o.nube.entrar(correo, clave);
      if (anterior !== s.usuarioId) {
        if (anterior && (await pendientes(b)).porEnviar > 0) {
          await o.nube.salir();
          throw new ErrorServidor("otro_usuario", "En este m\xF3vil hay cambios de otro t\xE9cnico que a\xFAn no han llegado a Vidaire. Que entre \xE9l y los env\xEDe antes.");
        }
        await o.vaciar();
        const nueva = laBase();
        await guardarAjuste(nueva, "usuario", s.usuarioId);
      }
      await guardarAjuste(laBase(), "correo", s.correo);
      error = null;
      identidad = await deducirIdentidad(laBase(), s.usuarioId, s.correo);
      await sincronizar();
      return identidad;
    }
    async function salir(forzar = false) {
      const b = o.base();
      if (b && !forzar && (await pendientes(b)).porEnviar > 0) {
        throw new ErrorServidor("pendientes", "Hay cambios sin enviar a Vidaire. Si sales ahora, se pierden.");
      }
      await o.nube.salir();
      await o.vaciar();
      identidad = null;
      ultima = null;
      sinRed = false;
      error = null;
      await avisar();
    }
    async function rechazados() {
      const b = o.base();
      if (!b) return [];
      return b.todas(`select tabla, coalesce(mensaje, '') as mensaje from cola where estado = 'rechazado' order by n`);
    }
    return { entrar, salir, sincronizar, recuperar, estado, rechazados, identidad: () => identidad };
  }

  // cxobra/mantenimiento/vidaire-publico.json
  var vidaire_publico_default = {
    url: "https://kuctmrwyejbzokmudroe.supabase.co",
    publishableKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1Y3Rtcnd5ZWpiem9rbXVkcm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MDY2ODYsImV4cCI6MjEwNjA4MjY4Nn0.Wdpx_549-Mrt-J7NhRcG_YCkciruU45b5gZBxNddc8M"
  };

  // cxobra/mantenimiento/fuente/motor.ts
  var SIN_NUBE = Boolean(false);
  var base = null;
  var CLAVE_SESION = "vidaire.mant.sesion";
  function sesionGuardada() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_SESION) ?? "null");
    } catch {
      return null;
    }
  }
  var nube = crearNube({
    url: vidaire_publico_default.url,
    clave: vidaire_publico_default.publishableKey,
    sesion: SIN_NUBE ? null : sesionGuardada(),
    alCambiarSesion: (s) => {
      try {
        if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
        else localStorage.removeItem(CLAVE_SESION);
      } catch {
      }
    }
  });
  var leerFichero = async (f) => {
    if (f.contenido !== null) return new TextEncoder().encode(f.contenido);
    const r = await fetch(f.uri);
    return new Uint8Array(await r.arrayBuffer());
  };
  var cuenta = crearCuenta({
    base: () => base,
    nube,
    vaciar: async () => {
      if (base) await base.vaciar();
    },
    leerFichero,
    hoy: () => hoyLocal(),
    alCambiar: (e, r) => {
      try {
        globalThis.dispatchEvent(new CustomEvent("vidaire:mant-sync", { detail: { estado: e, vuelta: r ?? null } }));
      } catch {
      }
    }
  });
  var reloj = null;
  function vigilar() {
    if (reloj || SIN_NUBE) return;
    reloj = setInterval(() => {
      if (nube.sesion()) void cuenta.sincronizar();
    }, 3e4);
    globalThis.addEventListener?.("online", () => {
      if (nube.sesion()) void cuenta.sincronizar();
    });
    globalThis.document?.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && nube.sesion()) void cuenta.sincronizar();
    });
  }
  async function iniciar(urlWasm) {
    if (!base) {
      base = await abrirBaseWasm(urlWasm);
      if (nube.sesion()) {
        await cuenta.recuperar();
        void cuenta.sincronizar();
      }
      vigilar();
    }
    return base;
  }
  function hoyLocal() {
    return ahoraLocalISO().slice(0, 10);
  }
  function contexto() {
    if (!base) throw new Error("El modo Mantenimiento a\xFAn no est\xE1 abierto.");
    const yo = cuenta.identidad();
    if (yo) return { base, usuarioId: yo.usuarioId, usuarioNombre: yo.nombre, organizacionId: yo.organizacionId, hoy: hoyLocal() };
    return { base, usuarioId: DEMO_USUARIO.id, usuarioNombre: DEMO_USUARIO.nombre, organizacionId: DEMO_USUARIO.organizacionId, hoy: hoyLocal() };
  }
  async function hayDatos() {
    if (!base) return false;
    const r = await base.una("select count(*) as n from equipos");
    return (r?.n ?? 0) > 0;
  }
  async function ejemplo() {
    if (!base) throw new Error("El modo Mantenimiento a\xFAn no est\xE1 abierto.");
    if (nube.sesion()) throw new Error("Has entrado en Vidaire: los datos de ejemplo se mezclar\xEDan con los tuyos.");
    await cargarDemo(base, hoyLocal());
  }
  async function vaciar() {
    if (base) await base.vaciar();
  }
  globalThis.MANT = {
    iniciar,
    contexto,
    hayDatos,
    ejemplo,
    vaciar,
    hoyLocal,
    uuid: uuidv7,
    /* La cuenta de Vidaire: entrar, salir, sincronizar, estado… (cuenta.ts). */
    nube: { ...cuenta, hay: !SIN_NUBE },
    mant: mantenimiento_exports,
    inc: incidencias_exports,
    reglas: reglas_exports,
    formato: formato_exports,
    almacen: almacen_exports,
    normativa: src_exports,
    es,
    base: () => base
  };
})();
