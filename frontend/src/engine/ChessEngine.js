// Chess rules engine + local fallback search.
// Ported from the tested single-file build (kiruma_souichi_chess.html).
// Used client-side for move legality/validation/rendering always, and as a
// fallback opponent brain only when the backend Stockfish API is unreachable.

// ================= ENGINE =================
const PCS = {'w':{'k':'♔','q':'♕','r':'♖','b':'♗','n':'♘','p':'♙'},'b':{'k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'}};
const PVAL = {'p':100,'n':320,'b':330,'r':500,'q':900,'k':20000};
const PST = {
  p:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,10,10,10,10,0,-10,-10,5,5,10,10,5,5,-10,-10,0,5,10,10,5,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  r:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,5,10,10,10,10,10,10,5,0,0,0,5,5,0,0,0],
  q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  k:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20]
};

class Engine {
  constructor() {
    this.b = this.init(); this.t='w'; this.c={w:{k:1,q:1},b:{k:1,q:1}};
    this.ep=null; this.hm=0; this.fm=1; this.hist=[]; this.mh=[];
  }
  init() {
    const back='rnbqkbnr', r=[];
    for(let i=0;i<8;i++) {
      let s='';
      for(let j=0;j<8;j++) {
        if(i===0)s+=back[j]; else if(i===1)s+='p'; else if(i===6)s+='P'; else if(i===7)s+=back[j].toUpperCase(); else s+='.';
      }
      r.push(s);
    }
    return r;
  }
  clone() {
    const e=new Engine(); e.b=this.b.map(x=>x); e.t=this.t; e.c=JSON.parse(JSON.stringify(this.c));
    e.ep=this.ep; e.hm=this.hm; e.fm=this.fm; e.hist=[...this.hist]; e.mh=[...this.mh]; return e;
  }
  at(r,c) { return r<0||r>7||c<0||c>7?null:this.b[r][c]; }
  empty(r,c) { return this.at(r,c)==='.'; }
  enemy(r,c) { const p=this.at(r,c); if(!p||p==='.')return 0; return (this.t==='w'&&p===p.toLowerCase())||(this.t==='b'&&p===p.toUpperCase()); }
  own(r,c) { const p=this.at(r,c); if(!p||p==='.')return 0; return (this.t==='w'&&p===p.toUpperCase())||(this.t==='b'&&p===p.toLowerCase()); }
  check(turn) {
    let kr=-1,kc=-1; const k=turn==='w'?'K':'k';
    for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(this.b[r][c]===k){kr=r;kc=c;break}
    if(kr===-1)return 0;
    const tmp=this.t; this.t=turn==='w'?'b':'w';
    const ms=this.pseudo(); this.t=tmp;
    for(const m of ms) if(m.tr===kr&&m.tc===kc)return 1;
    return 0;
  }
  pseudo() {
    const ms=[];
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const p=this.at(r,c); if(p==='.'||!this.own(r,c))continue;
      const pt=p.toLowerCase();
      if(pt==='p') {
        const d=this.t==='w'?-1:1, st=this.t==='w'?6:1, pr=r+d;
        if(pr>=0&&pr<8&&this.empty(pr,c)) {
          ms.push({fr:r,fc:c,tr:pr,tc:c,p:p});
          if(r===st&&this.empty(pr+d,c)) ms.push({fr:r,fc:c,tr:pr+d,tc:c,p:p});
        }
        for(const dc of [-1,1]) {
          const pc=c+dc;
          if(pc>=0&&pc<8&&pr>=0&&pr<8) {
            if(this.enemy(pr,pc)) ms.push({fr:r,fc:c,tr:pr,tc:pc,p:p});
            if(this.ep&&this.ep.r===pr&&this.ep.c===pc) ms.push({fr:r,fc:c,tr:pr,tc:pc,p:p,ep:1});
          }
        }
      } else if(pt==='n') {
        const ds=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for(const [dr,dc] of ds) { const nr=r+dr,nc=c+dc; if(nr>=0&&nr<8&&nc>=0&&nc<8&&!this.own(nr,nc)) ms.push({fr:r,fc:c,tr:nr,tc:nc,p:p}); }
      } else if(pt==='k') {
        for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
          if(dr===0&&dc===0)continue; const nr=r+dr,nc=c+dc;
          if(nr>=0&&nr<8&&nc>=0&&nc<8&&!this.own(nr,nc)) ms.push({fr:r,fc:c,tr:nr,tc:nc,p:p});
        }
        const row=this.t==='w'?7:0;
        if(r===row&&c===4) {
          if(this.c[this.t].k&&this.empty(row,5)&&this.empty(row,6)&&!this.empty(row,7)) ms.push({fr:r,fc:c,tr:row,tc:6,p:p,castle:'k'});
          if(this.c[this.t].q&&this.empty(row,3)&&this.empty(row,2)&&this.empty(row,1)&&!this.empty(row,0)) ms.push({fr:r,fc:c,tr:row,tc:2,p:p,castle:'q'});
        }
      } else {
        const dirs=pt==='b'?[[-1,-1],[-1,1],[1,-1],[1,1]]:pt==='r'?[[-1,0],[1,0],[0,-1],[0,1]]:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for(const [dr,dc] of dirs) {
          for(let i=1;i<8;i++) {
            const nr=r+dr*i,nc=c+dc*i;
            if(nr<0||nr>7||nc<0||nc>7)break;
            if(this.own(nr,nc))break;
            ms.push({fr:r,fc:c,tr:nr,tc:nc,p:p});
            if(this.enemy(nr,nc))break;
          }
        }
      }
    }
    return ms;
  }
  legal() {
    const ps=this.pseudo(), ls=[], mover=this.t;
    for(const m of ps) {
      this.move(m);
      const bad=this.check(mover);
      this.undo();
      if(!bad) ls.push(m);
    }
    return ls;
  }
  move(m) {
    const cap=this.b[m.tr][m.tc];
    this.hist.push({b:this.b.map(x=>x),t:this.t,c:JSON.parse(JSON.stringify(this.c)),ep:this.ep,hm:this.hm,fm:this.fm});
    let nr=this.b[m.fr].substring(0,m.fc)+'.'+this.b[m.fr].substring(m.fc+1); this.b[m.fr]=nr;
    let pr=m.p;
    if(m.p.toLowerCase()==='p'&&(m.tr===0||m.tr===7)) pr=this.t==='w'?'Q':'q';
    nr=this.b[m.tr].substring(0,m.tc)+pr+this.b[m.tr].substring(m.tc+1); this.b[m.tr]=nr;
    if(m.ep) { const cr=this.t==='w'?m.tr+1:m.tr-1; nr=this.b[cr].substring(0,m.tc)+'.'+this.b[cr].substring(m.tc+1); this.b[cr]=nr; }
    if(m.castle) {
      const row=this.t==='w'?7:0;
      if(m.castle==='k') { const a=this.b[row].split(''); a[5]=a[7]; a[7]='.'; this.b[row]=a.join(''); }
      else { const a=this.b[row].split(''); a[3]=a[0]; a[0]='.'; this.b[row]=a.join(''); }
    }
    if(m.p==='K') this.c.w={k:0,q:0}; if(m.p==='k') this.c.b={k:0,q:0};
    if(m.p==='R'&&m.fr===7&&m.fc===0) this.c.w.q=0; if(m.p==='R'&&m.fr===7&&m.fc===7) this.c.w.k=0;
    if(m.p==='r'&&m.fr===0&&m.fc===0) this.c.b.q=0; if(m.p==='r'&&m.fr===0&&m.fc===7) this.c.b.k=0;
    if(m.p.toLowerCase()==='p'&&Math.abs(m.tr-m.fr)===2) this.ep={r:(m.fr+m.tr)/2,c:m.fc}; else this.ep=null;
    if(m.p.toLowerCase()==='p'||cap!=='.') this.hm=0; else this.hm++;
    if(this.t==='b') this.fm++;
    this.t=this.t==='w'?'b':'w';
    this.mh.push(m);
    return {cap,promo:pr!==m.p?pr:null};
  }
  undo() {
    if(!this.hist.length)return 0;
    const h=this.hist.pop();
    this.b=h.b; this.t=h.t; this.c=h.c; this.ep=h.ep; this.hm=h.hm; this.fm=h.fm; this.mh.pop(); return 1;
  }
  over() {
    if(this.hm>=100)return{o:1,res:'draw',why:'50-move'};
    const ms=this.legal();
    if(!ms.length) {
      if(this.check(this.t))return{o:1,res:this.t==='w'?'black':'white',why:'checkmate'};
      return{o:1,res:'draw',why:'stalemate'};
    }
    let pcs=[];
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=this.at(r,c);if(p&&p!=='.')pcs.push(p.toLowerCase());}
    const mj=pcs.filter(x=>x!=='k');
    if(!mj.length)return{o:1,res:'draw',why:'insufficient'};
    if(mj.length===1&&(mj[0]==='n'||mj[0]==='b'))return{o:1,res:'draw',why:'insufficient'};
    return{o:0};
  }
  eval() {
    let sc=0;
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const p=this.at(r,c); if(p==='.')continue;
      const w=p===p.toUpperCase(), pt=p.toLowerCase();
      let v=PVAL[pt];
      if(PST[pt]) { const sq=w?(7-r)*8+c:r*8+c; v+=PST[pt][sq]; }
      if(pt==='p') {
        const row=w?6-r:r-1; v+=[0,50,10,5,0,5,5,0][row];
        if((r===3||r===4)&&(c===3||c===4)) v+=15;
      }
      if((pt==='n'||pt==='b')&&(r>=2&&r<=5)&&(c>=2&&c<=5)) v+=10;
      if(pt==='r'&&((w&&r<=2)||(!w&&r>=5))) v+=15;
      if(pt==='k') { const kr=w?6-r:r; if(kr>=6) v+=20; }
      sc+=w?v:-v;
    }
    sc+=(this.countMoves('w')-this.countMoves('b'))*3;
    return this.t==='w'?sc:-sc;
  }
  countMoves(turn) { const tmp=this.t; this.t=turn; const n=this.pseudo().length; this.t=tmp; return n; }
  toFEN() {
    const rows=this.b.map(row=>{
      let s='',empty=0;
      for(const ch of row) { if(ch==='.') empty++; else { if(empty){s+=empty;empty=0;} s+=ch; } }
      if(empty) s+=empty;
      return s;
    });
    let castle='';
    if(this.c.w.k)castle+='K'; if(this.c.w.q)castle+='Q'; if(this.c.b.k)castle+='k'; if(this.c.b.q)castle+='q';
    if(!castle)castle='-';
    const f='abcdefgh', rk='87654321';
    const ep=this.ep?f[this.ep.c]+rk[this.ep.r]:'-';
    return `${rows.join('/')} ${this.t} ${castle} ${ep} ${this.hm} ${this.fm}`;
  }
}

// ================= SEARCH =================
class SearchAbort extends Error {}
let sNodes=0, sDeadline=0;

function mvScore(e,m) {
  const t=e.at(m.tr,m.tc);
  if(t&&t!=='.') return 10000+PVAL[t.toLowerCase()]-PVAL[m.p.toLowerCase()]/10;
  if(m.p.toLowerCase()==='p'&&(m.tr===0||m.tr===7)) return 9000;
  return 0;
}
function orderMoves(e,ms) { ms.sort((x,y)=>mvScore(e,y)-mvScore(e,x)); return ms; }

function negamax(e,d,a,b) {
  sNodes++;
  if((sNodes&1023)===0 && performance.now()>sDeadline) throw new SearchAbort();
  const ms=e.legal();
  if(!ms.length) return e.check(e.t) ? -29000-d : 0;
  if(e.hm>=100) return 0;
  if(d<=0) return qsearch(e,a,b);
  orderMoves(e,ms);
  for(const m of ms) {
    e.move(m);
    let sc;
    try { sc=-negamax(e,d-1,-b,-a); }
    finally { e.undo(); }
    if(sc>=b) return b;
    if(sc>a) a=sc;
  }
  return a;
}
function qsearch(e,a,b) {
  sNodes++;
  if((sNodes&1023)===0 && performance.now()>sDeadline) throw new SearchAbort();
  const stand=e.eval();
  if(stand>=b) return b;
  if(stand>a) a=stand;
  const caps=e.legal().filter(m=>e.at(m.tr,m.tc)!=='.'||m.ep);
  caps.sort((x,y)=>mvScore(e,y)-mvScore(e,x));
  for(const m of caps) {
    e.move(m);
    let sc;
    try { sc=-qsearch(e,-b,-a); }
    finally { e.undo(); }
    if(sc>=b) return b;
    if(sc>a) a=sc;
  }
  return a;
}
function bestMove(e,timeMs,maxDepth) {
  const ms=e.legal(); if(!ms.length)return null;
  let overallBest=ms[0], overallScore=0;
  sNodes=0; sDeadline=performance.now()+timeMs;
  orderMoves(e,ms);
  let depth=1;
  try {
    while(depth<=maxDepth) {
      let best=ms[0], bestScore=-99999, a=-99999, b=99999;
      for(const m of ms) {
        e.move(m);
        let sc;
        try { sc=-negamax(e,depth-1,-b,-a); }
        finally { e.undo(); }
        if(sc>bestScore){bestScore=sc;best=m;}
        if(sc>a)a=sc;
      }
      overallBest=best; overallScore=bestScore;
      ms.splice(ms.indexOf(best),1); ms.unshift(best);
      if(performance.now()>sDeadline) break;
      depth++;
    }
  } catch(err) { if(!(err instanceof SearchAbort)) throw err; }
  return {m:overallBest,s:overallScore};
}

function parseUCIMove(eng, u) {
  if (!u || u.length < 4 || u === '(none)') return null;
  const f = 'abcdefgh', rk = '87654321';
  const fc = f.indexOf(u[0]), fr = rk.indexOf(u[1]), tc = f.indexOf(u[2]), tr = rk.indexOf(u[3]);
  return eng.legal().find(m => m.fr === fr && m.fc === fc && m.tr === tr && m.tc === tc) || null;
}

export { Engine, bestMove, parseUCIMove, PCS, PVAL };
