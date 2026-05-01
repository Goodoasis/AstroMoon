export let $ = null;

const N = Math.exp, P = Math.sqrt, Q = Math.log, R = Math.random, X = P(0.5), G = 256, J = 512, K = r => r.length, O = (r, e, t) => r.slice(e, t), Y = function () {
    return new Float32Array(...arguments)
};

const a = r => e => {
    var t = Y(K(e));
    for (let a = 0; a < K(e); a++) t[a] = r(e[a]);
    return t;
};
const l = a(r => Q(r));
const o = a(r => 1 / (1 + N(-r)));
const n = a(r => Q(1 + N(r)));
const v = a(r => {
    var e = N(2 * r);
    return (e - 1) / (e + 1);
});
const i = r => (e, t) => {
    var a = "number" == typeof t, l = Y(K(e));
    for (let o = 0; o < K(e); o++) l[o] = r(e[o], a ? t : t[o]);
    return l;
};

const u = i((r, e) => r + e);
const f = i((r, e) => r - e);
const s = i((r, e) => r * e);
const h = i((r, e) => r / e);
const d = r => {
    var e = Y(K(r)), t = 0;
    for (let a = 0; a < K(r); a++) e[a] = N(r[a]), t += e[a];
    for (let r = 0; r < K(e); r++) e[r] = e[r] / t;
    return e;
};
const p = (r, e) => {
    for (let t = 0; t < K(r) / G; t++)
        for (let a = 0; a < K(e); a++) r[t * G + a] = r[t * G + a] + e[a];
    return r;
};
const w = (r, e, t) => {
    var a = K(r) + K(e), l = Y(a);
    for (let e = 0; e < K(r); e++) l[e] = r[e];
    for (let t = 0; t < K(e); t++) l[t + K(r)] = e[t];
    return l;
};
const m = (r, e) => {
    var t = K(e) / K(r), a = Y(t);
    for (let o = 0; o < t; o++) {
        var l = 0;
        for (let a = 0; a < K(r); a++) l += r[a] * e[a * t + o];
        a[o] = l;
    }
    return a;
};
const g = (r, e) => {
    var [t, a, l, o] = e, n = t[0], v = Y(n);
    for (let e = 0; e < n; e++) {
        var i = o[e], u = o[e + 1], f = 0;
        for (let e = i; e < u; e++) f += a[e] * r[l[e]];
        v[e] = f;
    }
    return v;
};
const b = (r, e) => {
    var t = K(r) / e, a = [];
    for (let o = 0; o < e; o++) {
        var l = O(r, o * t, (o + 1) * t);
        a.push(l);
    }
    return a;
};
const M = (r, e) => {
    var t = [K(r), e], a = Y(t[0] * t[1]);
    for (let e = 0; e < t[0]; e++)
        for (let l = 0; l < t[1]; l++) a[e * t[1] + l] = r[e];
    return a;
};
const y = (r, e) => {
    var t = [e[1]], a = Y(t[0]);
    for (let t = 0; t < e[0]; t++)
        for (let l = 0; l < e[1]; l++) a[l] += r[t * e[1] + l];
    return a;
};
const x = (r, e, t) => {
    var a = [K(e), t], l = Y(a[0] * a[1]);
    for (let a = 0; a < K(e); a++) {
        var o = e[a], n = O(r, o * t, (o + 1) * t);
        l.set(n, a * t);
    }
    return l;
};
const C = (r, e, t) => {
    var a, l_val, n, i;
    if (1 == t) a = e.a, l_val = e.d, n = $.y, i = $.p;
    else if (2 == t) n = $.w, i = $.q, a = e.b, l_val = e.e;
    else n = $.r, i = $.f, a = e.c, l_val = e.f;
    r = w(r, l_val);
    var f_val = u(g(r, n), i)
        , [h_val, d_val, c, p_val] = b(f_val, 4)
        , m_val = u(s(o(c), a), s(o(h_val), v(d_val)))
        , M_val = s(o(p_val), v(m_val));
    return 1 == t ? (e.a = m_val, e.d = M_val) : 2 == t ? (e.b = m_val, e.e = M_val) : (e.c = m_val, e.f = M_val), M_val;
};
const A = r => {
    r = [0, ...r, 0], r = Y(r);
    var e, t = ((r, e) => {
        var t = [K(r) / G - 2, G], a = Y(t[0] * t[1]);
        for (let n = 0; n < t[0]; n++) {
            var l = O(r, n * G, (n + 3) * G);
            for (let r = 0; r < t[1]; r++) {
                var o = 0;
                for (let t = 0; t < K(l); t++) o += l[t] * e[r + G * t];
                a[n * t[1] + r] = o;
            }
        }
        return a;
    })(e = ((r, e) => {
        var t = [K(e), G], a = Y(t[0] * t[1]);
        for (let t = 0; t < K(e); t++) {
            var l = e[t], o = O(r, l * G, (l + 1) * G);
            a.set(o, t * G);
        }
        return a;
    })($.s, r), $.b), a = (t = p(t, $.t),
        t = v(t),
        ((r, e, t) => {
            var a = [K(r) / G, J], l = Y(a[0] * a[1]);
            for (let e = 0; e < a[0]; e++)
                for (let t = 0; t < G; t++) l[e * a[1] + t] = r[e * G + t];
            for (let r = 0; r < a[0]; r++)
                for (let t = 0; t < G; t++) l[r * a[1] + t + G] = e[r * G + t];
            return l;
        })(e = O(e, G, K(e) - G), t)), l_val = $.j, o_val = $.E;
    return t = p(((r, e) => {
        var t = [K(r) / J, J], a = [J, K(e) / J], l = K(e) / G, o = [K(r) / J, K(e) / J], n = Y(o[0] * o[1]);
        for (let i = 0; i < o[0]; i++)
            for (let u = 0; u < o[1]; u++) {
                var v = 0;
                for (let o = 0; o < l; o++) v += r[i * t[1] + o] * e[o * a[1] + u];
                n[i * o[1] + u] = v;
            }
        return n;
    })(a, l_val), o_val);
};
const k = (r, e, er) => {
    var t = m(r, $.h), [a, l_val, v_val] = (t = u(t, $.n), b(t, 3));
    l_val = n(l_val);
    v_val = n(v_val);
    a = d(a);
    v_val = u(e.k, h(v_val, 15));
    e.k = v_val;
    var i = e.u;
    a = M(a, K(i) / 10 - 1);
    l_val = M(l_val, K(i) / 10);
    v_val = M(v_val, K(i) / 10);
    var c = o(h(f(i, v_val), l_val))
        , p_val = s(a, (r => {
            var e = [10, K(r) / 10], t = [e[0], e[1] - 1], a = Y(t[0] * t[1]);
            for (let o = 0; o < t[0]; o++) {
                var l = o * e[1];
                for (let e = 0; e < t[1]; e++) a[o * t[1] + e] = r[l + e + 1] - r[l + e];
            }
            return a;
        })(c))
        , w_val = y(p_val, [10, K(p_val) / 10]);
    t = er;
    w_val = M(w_val, G);
    var g_val = y(s(w_val, t), [K(w_val) / G, G]);
    return e.w = g_val, g_val;
};
const F = (r, e, er) => {
    var t = m(r, $.i)
        , a = (t = u(t, $.W), t = s(u(t, e.z), X), C(t, e, 1))
        , l_val = (t = s(u(t, a), X), w(t, e.w))
        , n = C(l_val, e, 2)
        , i = k(n, e, er)
        , f_val = w(n, i)
        , h_val = (f_val = g(f_val, $.l), f_val = u(f_val, $.Q), f_val = v(f_val), t = s(u(t, f_val), X), (r => {
            var e = $.c, t = $.u;
            return o(u(m(r, e), t));
        })(i))
        , d_val = C(t, e, 3)
        , c = (t = s(u(t, d_val), X), m(t, $.z));
    return [c = u(c, $.v), h_val];
};
const U = (r, bias) => {
    var [e, t] = ((r, e) => {
        var t = [], a = 0;
        for (let v = 0; v < K(e); v++) {
            var l = a, o = a + e[v], n = O(r, l, o);
            a = o, t.push(n);
        }
        return t;
    })(r, [120, 1])
        , a = o(t)[0]
        , i = R() < a ? 1 : 0
        , [f_val, c, p_val, w_val] = ((r, e) => {
            var t = [], a = 0;
            for (let v = 0; v < K(e); v++) {
                var l = a;
                a += e[v];
                var o = [20, e[v]], n = Y(20 * e[v]);
                for (let t = 0; t < 20; t++)
                    for (let a = 0; a < e[v]; a++) n[t * o[1] + a] = r[6 * t + (l + a)];
                t.push(n);
            }
            return t;
        })(e, [1, 2, 1, 2]);
    p_val = v(p_val);
    c = h(n(c), N(bias));
    f_val = (f_val = l(d(f_val)), s(f_val, 1 + bias));
    for (let r = 0; r < K(f_val); r++) f_val[r] < Q(.02) && (f_val[r] = f_val[r] - 100);
    var b_val = (r => {
        var e = -1e6, t = 0;
        for (let o = 0; o < K(r); o++) {
            var a = -Q(-Q(R())), l = r[o] + a;
            l > e && (t = o, e = l);
        }
        return Y([t]);
    })(f_val)
        , M_val = x(w_val, b_val, 2)
        , y_val = x(c, b_val, 2)
        , C_val = x(p_val, b_val, 1)
        , A_val = y_val[0]
        , k_val = y_val[1]
        , F_val = [A_val, (C_val = C_val[0]) * k_val, 0, k_val * P(1 - C_val * C_val)];
    F_val = Y(F_val);
    var U_val = (r => {
        var e = Y(r);
        for (let n = 0; n < r; n++) {
            var t = 1 - R(), a = 1 - R(), l = P(-2 * Q(t)), o = Math.cos(2 * Math.PI * a);
            e[n] = l * o;
        }
        return e;
    })(2)
        , L_val = u(M_val, m(U_val, F_val))
        , E = [L_val[0], L_val[1], i];
    return E = Y(E);
};
const L = (r, e, er, bias) => {
    var [t, a] = F(r, e, er);
    return [U(t, bias), a, e];
};

const j = (r, e) => [e[0] + r[0], e[1] + r[1]];
const I = (r, e) => [r[0] - e[0], r[1] - e[1]];
const T = (r, e) => [e * r[0], e * r[1]];

const V_func = (r, e, t) => {
    var a = 0, l = [], o = [], n = [];
    for (let f = 0; f < K(r); f++) {
        var v = r[f];
        a += e[f];
        var i = Math.floor(a / t[1]), u = a % t[1];
        0 != v && (l.push(v), o.push(u), n.push(i));
    }
    var f_arr = [0], s = 0;
    for (let r = 0; r < t[0]; r++) {
        for (; n[s] == r;) s += 1;
        f_arr.push(s);
    }
    return [t, l, o, f_arr];
};
const _ = (r, e, t) => {
    var a = t.reduce((r, e) => r * e, 1), l = Y(a), o = K(r), n = 0;
    for (let t = 0; t < o; t++) {
        var v = r[t];
        l[n += e[t]] = v;
    }
    return l;
};
const D = r => {
    for (var e = "", t = 0; t < K(r); t++) e += String.fromCharCode(r[t]);
    return e;
};
const sr = r => r.toFixed(2);
const B = r => {
    var e = [];
    for (let o = 0; o < K(r); o++) {
        if (0 == o) {
            var t = r[o + 1][0] - r[o][0], a = r[o + 1][1] - r[o][1];
        } else {
            t = r[o][0] - r[o - 1][0]; a = r[o][1] - r[o - 1][1];
        }
        var l = Math.sqrt(Math.pow(t, 2) + Math.pow(a, 2));
        e.push(l);
    }
    var o_arr = [];
    for (let r = 0; r < K(e); r++) {
        var n = Math.max(r - 2, 0), v = Math.min(r + 2 + 1, K(e)), i = 0;
        for (let r = n; r < v; r++) i += e[r];
        var u = i / (v - n);
        o_arr.push(u);
    }
    return o_arr;
};
const z = r => {
    for (var e = [], t = 0, a = K(r); t < a;) {
        for (var l = []; t < a && 1 != r[t][2];) l.push(r[t]), t += 1;
        t < a && l.push(r[t]), t += 1, e.push(l);
    }
    return e;
};

const H = {
    "": 0, "\u0002": 2, " ": 8, '"': 4, "&": 84, "(": 66, "*": 80, ",": 37, ".": 7,
    0: 62, 2: 63, 4: 68, 6: 71, 8: 76, ":": 74, B: 47, D: 52, F: 53, H: 41,
    J: 64, L: 48, N: 38, P: 46, R: 55, T: 31, V: 39, X: 79, Z: 78, b: 32,
    d: 27, f: 35, h: 30, j: 43, l: 26, n: 15, p: 29, r: 6, t: 21, v: 34,
    x: 44, z: 10, "\u0001": 1, "\u0003": 3, "!": 72, "#": 56, "'": 16, ")": 67,
    "+": 82, "-": 40, "/": 77, 1: 59, 3: 69, 5: 61, 7: 70, 9: 60, ";": 73,
    "?": 51, A: 9, C: 57, E: 42, G: 45, I: 23, K: 58, M: 5, O: 36, Q: 75,
    S: 18, U: 65, W: 54, Y: 50, "[": 81, "]": 83, a: 14, c: 20, e: 19, g: 33,
    i: 13, k: 28, m: 12, o: 25, q: 49, s: 17, u: 11, w: 24, y: 22
};

const q_str = (r, e, t) => {
    var a = [], l = [], o = B(r);
    for (let d = 0; d < K(r); d++) {
        var n, v;
        if (0 == d) {
            n = r[d + 1][0] - r[d][0]; v = r[d + 1][1] - r[d][1];
        } else if (d == K(r) - 1) {
            n = r[d][0] - r[d - 1][0]; v = r[d][1] - r[d - 1][1];
        } else {
            n = r[d + 1][0] - r[d - 1][0]; v = r[d + 1][1] - r[d - 1][1];
        }
        var i = Math.sqrt(Math.pow(n, 2) + Math.pow(v, 2));
        i = Math.max(i, 14);
        var u = o[d] / e;
        var f_val = [-v / i, n / i];
        f_val = [t * f_val[0], t * f_val[1]];
        f_val = [f_val[0] / u, f_val[1] / u];
        
        var s_val = r[d][0] + 2 * f_val[0], h_val = r[d][1] + 2 * f_val[1];
        a.push([s_val, h_val]);
        s_val = r[d][0] - 2 * f_val[0]; h_val = r[d][1] - 2 * f_val[1];
        l.push([s_val, h_val]);
    }
    var d_arr = a.concat(l.reverse());
    var c = [["M ", sr(d_arr[0][0]), ",", sr(d_arr[0][1])].join("")];
    var p_val = K(d_arr);
    for (let r = 0; r < p_val; r++) {
        var w_val = d_arr[(r - 1 + p_val) % p_val], m_val = d_arr[r], g_val = d_arr[(r + 1) % p_val], b_val = d_arr[(r + 2) % p_val];
        var M_val = I(g_val, w_val), y_val = I(b_val, m_val);
        var x_val = j(m_val, T(M_val, .2)), C_val = I(g_val, T(y_val, .2));
        var A_val = "C " + sr(x_val[0]) + " " + sr(x_val[1]) + ", " + sr(C_val[0]) + " " + sr(C_val[1]) + ", " + sr(g_val[0]) + " " + sr(g_val[1]);
        c.push(A_val);
    }
    return c.join(" ");
};

function generateSvgPathStr(w_arr, t_val, strokeWidth) {
    if (K(w_arr) === 0) return "";
    var strokes = z(w_arr);
    var pathData = [];
    for (let n = 0; n < K(strokes); n++) {
        var a = strokes[n];
        if (K(a) >= 2 || (K(a) !== 0 && a[0][2] === 1)) {
            if (K(a) >= 2) {
                pathData.push(q_str(a, t_val, strokeWidth));
            }
        }
    }
    return pathData.join(" ");
}

/**
 * Charge le modèle binaire (handwriting_model.bin).
 * @param {string} url - Le chemin d'accès vers handwriting_model.bin.
 */
export async function loadModel(url = '/handwriting_model.bin') {
    if ($) return; // Déjà chargé
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossible de charger le modèle (${res.status}): vérifiez que ${url} existe bien dans le dossier public.`);
    const r = await res.arrayBuffer();
    
    var e = 0, t = {}, a = new DataView(r);
    var l_val = () => {
        do {
            if (e >= a.byteLength) break;
            var o = a.getUint8(e); e += 1;
            var n = new Uint8Array(o);
            for (let r = 0; r < o; r++) { n[r] = a.getUint8(e); e += 1; }
            n = D(n);
            var v = a.getUint8(e); e += 1;
            var i = a.getUint32(e, !0); e += 4;
            var u = new Float32Array(i);
            for (let r = 0; r < i; r++) { u[r] = a.getFloat32(e, !0); e += 4; }
            if (v) {
                var f = new Uint8Array(i);
                for (let r = 0; r < i; r++) { f[r] = a.getUint16(e, !0); e += 1; }
            }
            var s = a.getUint8(e); e += 1;
            var h = new Uint16Array(s);
            for (let r = 0; r < s; r++) { h[r] = a.getUint16(e, !0); e += 2; }
            if (["y", "w", "r", "l"].includes(n)) {
                u = V_func(u, f, h);
            } else if (v) {
                u = _(u, f, h);
            }
            t[n] = u;
        } while (e < a.byteLength);
    };
    l_val();
    $ = t;
}

/**
 * Génère le tracé SVG manuscrit de manière synchrone.
 * @param {string} text - Le texte à écrire
 * @param {number} styleVal - ID du style (ex: 21)
 * @param {number} bias - Legibility (ex: 0.75)
 * @param {number} strokeWidth - Épaisseur (ex: 0.75)
 * @returns {Object} - { d: "path string", viewBox: "x y w h" }
 */
export function generatePath(text, styleVal = 21, bias = 0.75, strokeWidth = 0.75) {
    if (!$) throw new Error("Le modèle d'écriture n'est pas chargé (appelez loadModel).");
    if (!text || text.trim() === "") return { d: "", viewBox: "0 0 100 100" };

    const baseWidth = 1000;

    let c = text.trim().replace(/\s+/g, " ");
    const n = K(c);
    
    const v_scale = Math.min(105 / n, 11) * (baseWidth / 1240);
    const t_val = v_scale;

    c = (r => {
        var e = r.split("").map(r => r in H ? H[r] : 1);
        return e = [2, ...e, 3], Y(e);
    })(c);

    const er = A(c);

    var h_state = ((r, e) => {
        var t = [10, r], a = Y(t[0] * t[1]);
        for (let r = 0; r < t[0]; r++)
            for (let e = 0; e < t[1]; e++) a[r * t[1] + e] = e - .5;
        var l_val = $.g, o = O(l_val, 64 * e, 64 * (e + 1)), n_val = $.k, v_val = $.R;
        var i = (o = u(m(o, n_val), v_val), Y(10));
        return { a: $.d, b: $.o, c: $.e, d: $.m, e: $.x, f: $.a, w: $.T, k: i, u: a, z: o };
    })(K(c) + 1, styleVal);

    var d_step = 0;
    var r_state = h_state;
    var e_state = [Y([0, 0, 1])];
    
    // Start coordinates
    var w_arr = [Y([0, 0, 1])];

    while (true) {
        var a = e_state[K(e_state) - 1];
        var [l_val, o_val, new_r_state] = L(a, r_state, er, bias);
        r_state = new_r_state;
        
        if ((d_step += 1) > 40 * n || o_val > .5) {
            break;
        }
        e_state.push(l_val);
        var xi_c = [w_arr[K(w_arr) - 1][0] + v_scale * l_val[0], w_arr[K(w_arr) - 1][1] - v_scale * l_val[1], l_val[2]];
        w_arr.push(Y(xi_c));
    }

    const pathString = generateSvgPathStr(w_arr, t_val, strokeWidth);

    // Calcul de la viewBox depuis les coordonnées
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < K(w_arr); i++) {
        let x = w_arr[i][0];
        let y = w_arr[i][1];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }

    // Ajout d'une marge à la viewBox
    const padding = 15;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return {
        d: pathString,
        viewBox: `${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`
    };
}
