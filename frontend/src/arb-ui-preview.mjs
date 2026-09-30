// Offline UI fixture: uses actual Sure/ArbTracker components with in-memory RPCs.
// Usage: node frontend/src/arb-ui-preview.mjs <output-directory>
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const output = path.resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const fixture = {
  bankroll: { opening_amount: 300 },
  consent: false,
  attempts: [
    {
      id: "open",
      status: "partial",
      started_at: "2026-09-30T10:01:00Z",
      source_updated_at: "2026-09-30T10:00:00Z",
      offer_snapshot: {
        ottelu: "Esimerkki: Joukkue A – Joukkue B",
        markkina: "totals 6.5",
        profit_pct: 2,
      },
    },
    {
      id: "done",
      status: "settled",
      started_at: "2026-09-29T10:01:00Z",
      source_updated_at: "2026-09-29T10:00:00Z",
      offer_snapshot: {
        ottelu: "Esimerkki: Joukkue C – Joukkue D",
        markkina: "h2h 2-way",
        profit_pct: 2,
      },
    },
  ],
  legs: [
    {
      id: "open1",
      attempt_id: "open",
      ordinal: 0,
      status: "placed",
      offered_outcome: "Over 6.5",
      offered_book: "Coolbet",
      offered_odds: 2.1,
      actual_book: "Coolbet",
      actual_odds: 2.1,
      actual_stake: 100,
      placed_at: "2026-09-30T10:01:10Z",
    },
    {
      id: "open2",
      attempt_id: "open",
      ordinal: 1,
      status: "pending",
      offered_outcome: "Under 6.5",
      offered_book: "Pinnacle",
      offered_odds: 2.05,
    },
    {
      id: "done1",
      attempt_id: "done",
      ordinal: 0,
      status: "settled",
      offered_outcome: "Joukkue C",
      offered_book: "Coolbet",
      offered_odds: 2.04,
      actual_book: "Coolbet",
      actual_odds: 2.04,
      actual_stake: 150,
      returned_amount: 306,
      result: "win",
      placed_at: "2026-09-29T10:01:10Z",
      settled_at: "2026-09-29T14:00:00Z",
    },
    {
      id: "done2",
      attempt_id: "done",
      ordinal: 1,
      status: "settled",
      offered_outcome: "Joukkue D",
      offered_book: "Pinnacle",
      offered_odds: 2.04,
      actual_book: "Pinnacle",
      actual_odds: 2.04,
      actual_stake: 150,
      returned_amount: 0,
      result: "lose",
      placed_at: "2026-09-29T10:01:20Z",
      settled_at: "2026-09-29T14:00:01Z",
    },
  ],
  corrections: [],
  wallets: [],
  cashEntries: [],
};
const offer = {
  id: "fixture-offer",
  match: "Esimerkki: Joukkue E – Joukkue F",
  league: "NHL",
  market: "totals 6.5",
  profit: 2,
  sourceUpdatedAt: new Date().toISOString(),
  startsAt: "2026-10-01T20:00:00Z",
  legs: [
    { outcome: "Over 6.5", book: "Coolbet", odds: 2.1, share: 49 },
    { outcome: "Under 6.5", book: "Pinnacle", odds: 2.02, share: 51 },
  ],
};
const mockTracker = `
let data=${JSON.stringify(fixture)};
export async function loadArbTracker(){return structuredClone(data)}
export async function setArbBankroll(amount){data.bankroll={opening_amount:amount}}
export async function setArbAttemptDeleted(id,deleted){data.attempts.find(a=>a.id===id).deleted_at=deleted?new Date().toISOString():null}
export async function setArbAnalyticsConsent(value){data.consent=value}
export async function closeArbAttempt(id,reason){Object.assign(data.attempts.find(a=>a.id===id),{status:'abandoned',reason})}
export async function markArbLegUnavailable(id,reason,odds){Object.assign(data.legs.find(l=>l.id===id),{status:'unavailable',failure_reason:reason,actual_odds:odds})}
export async function createArbAttempt(){throw Error('Preview: no real offer writes')}
export async function recordArbLeg(id,action,v){
 const leg=data.legs.find(l=>l.id===id);
 if(action==='place')Object.assign(leg,{actual_book:v.book,actual_odds:v.odds,actual_stake:v.stake,status:'placed',placed_at:new Date().toISOString()});
 if(action==='settle')Object.assign(leg,{result:v.result,returned_amount:v.returned,status:'settled',settled_at:new Date().toISOString()});
 if(action==='edit')Object.assign(leg,{actual_book:v.book,actual_odds:v.odds,actual_stake:v.stake,...(v.returned!=null?{returned_amount:v.returned,result:v.result}:{})});
}
`;
await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Sure from './pages/Sure.jsx'; import './styles.css'; import {ThemeProvider} from './theme.jsx'; createRoot(document.getElementById('root')).render(<ThemeProvider><div style={{width:'100%',overflowY:'auto'}}><p>PAIKALLINEN LUONNOS · Kaikki kohteet ja luvut ovat fiktiivisiä.</p><Sure /></div></ThemeProvider>);`,
    resolveDir: path.resolve("frontend/src"),
    loader: "jsx",
  },
  bundle: true,
  format: "esm",
  outfile: path.join(output, "preview.js"),
  plugins: [
    {
      name: "offline-fixtures",
      setup(b) {
        b.onLoad({ filter: /[\\/]arb-tracker\.js$/ }, () => ({
          contents: mockTracker,
          loader: "js",
        }));
        b.onLoad({ filter: /[\\/]context[\\/]VedoxContext\.jsx$/ }, () => ({
          contents: `export function useVedox(){return {arbitrages:[${JSON.stringify(offer)}],stats:{paivitetty:'juuri nyt'},refreshEvBets:()=>{},loading:false,session:{user:{id:'fixture-owner'}},authReady:true,permissionsReady:true,setShowAuth:()=>{},canAccess:()=>true}}`,
          loader: "js",
        }));
      },
    },
  ],
});
await writeFile(
  path.join(output, "index.html"),
  `<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Arbitraasisivun paikallinen luonnos</title><link rel="stylesheet" href="preview.css"></head><body><div id="root"></div><script type="module" src="preview.js"></script></body></html>`,
);
console.log("Offline preview built with fictional data.");
