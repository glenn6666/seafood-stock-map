const n="今天有效，當日 23:59 止。限店內商品使用，團購不適用；滿額門檻不含團購金額。";function u(t){return!/團購|group[\s_-]?buy/i.test(t.category??"")}function s(t,o){return t.filter(u).reduce((e,r)=>e+o(r),0)}export{n as C,s};
