// Run with ARB_PGLITE_MODULE=file:///.../pglite/dist/index.js (temporary test dependency).
// In-memory PostgreSQL only. No network, Supabase credentials or real user data.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
process.on("uncaughtException", (e) => {
  console.error(e.message);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error(e.message);
  process.exit(1);
});
const { PGlite } = await import(process.env.ARB_PGLITE_MODULE);
const db = new PGlite();
const a = "00000000-0000-0000-0000-000000000001",
  b = "00000000-0000-0000-0000-000000000002";
await db.exec(`create role anon; create role authenticated;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create table public.profiles(id uuid,tier_code text);
create table public.arbitrages(id text,actief boolean,aktiivinen boolean,paivitetty timestamptz,outcomes_json jsonb);
insert into auth.users values('${a}'),('${b}');
insert into public.profiles values('${a}','all_star'),('${b}','all_star');`);
await db.exec("grant select on public.arbitrages to authenticated");
await db.exec(
  await readFile(
    new URL("./2026-09-22-user-arbitrage-tracker.sql", import.meta.url),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL("./2026-09-30-arbitrage-shared-bankroll.sql", import.meta.url),
    "utf8",
  ),
);
await db.exec(`set "test.user"='${a}'; insert into public.arbitrages values('offer',true,true,now(),
 '[{"book":"A","outcome":"Home","odds":2.04},{"book":"B","outcome":"Away","odds":2.04}]');`);
await db.exec(`set role authenticated; select public.arb_set_bankroll(300);`);
const attempt = (
  await db.query(
    `select public.arb_create_attempt('offer',(select paivitetty from public.arbitrages where id='offer')) as id`,
  )
).rows[0].id;
const ids = (
  await db.query(`select id from public.user_arb_legs order by ordinal`)
).rows.map((x) => x.id);
const call = (
  id,
  action,
  book = null,
  odds = null,
  stake = null,
  result = null,
  returned = null,
) =>
  db.query("select public.arb_record_leg_v2($1,$2,$3,$4,$5,$6,$7,$8)", [
    id,
    action,
    book,
    odds,
    stake,
    result,
    returned,
    "Test correction",
  ]);
await call(ids[0], "place", "A", 2.04, 150);
await assert.rejects(
  call(ids[0], "place", "A", 2.04, 150),
  /leg_not_placeable/,
);
await assert.rejects(
  call(ids[1], "place", "B", 2.04, 151),
  /insufficient_shared_balance/,
);
await call(ids[1], "place", "B", 2.04, 150);
await call(ids[0], "settle", null, null, null, "win", 306);
await call(ids[1], "settle", null, null, null, "lose", 0);
await assert.rejects(
  call(ids[1], "settle", null, null, null, "lose", 0),
  /leg_not_settleable/,
);
await db.exec("reset role");
const available = async () =>
  Number(
    (await db.query("select public.arb_pool_available($1) as n", [a])).rows[0]
      .n,
  );
assert.equal(await available(), 306);
await db.exec("set role authenticated");
await call(ids[0], "edit", "A", 2.02, 150, "win", 303);
await db.exec("reset role");
assert.equal(await available(), 303);
await db.exec("set role authenticated");
const nextAttempt = (
  await db.query(
    `select public.arb_create_attempt('offer',(select paivitetty from public.arbitrages where id='offer')) as id`,
  )
).rows[0].id;
const next = (
  await db.query(
    "select id from public.user_arb_legs where attempt_id=$1 order by ordinal",
    [nextAttempt],
  )
).rows.map((x) => x.id);
await call(next[0], "place", "A", 2.04, 10);
const placedAt = (
  await db.query("select placed_at from public.user_arb_legs where id=$1", [
    next[0],
  ])
).rows[0].placed_at;
await call(next[0], "edit", "A", 2.02, 10);
await call(next[0], "settle", null, null, null, "win", 20.2);
assert.equal(
  (
    await db.query("select placed_at from public.user_arb_legs where id=$1", [
      next[0],
    ])
  ).rows[0].placed_at.getTime(),
  placedAt.getTime(),
);
await db.exec("reset role");
assert.equal(await available(), 313.2);
await db.exec(
  `set role authenticated; select public.arb_set_attempt_deleted('${nextAttempt}',true);`,
);
await assert.rejects(call(next[1], "place", "B", 2, 10), /attempt_deleted/);
await db.exec("reset role");
assert.equal(await available(), 303);
await db.exec(
  `set role authenticated; select public.arb_set_attempt_deleted('${attempt}',true);`,
);
await db.exec("reset role");
assert.equal(await available(), 300);
await db.exec(
  `set role authenticated; select public.arb_set_attempt_deleted('${attempt}',false);`,
);
await db.exec("reset role");
assert.equal(await available(), 303);
await db.exec(
  `set "test.user"='${b}'; set role authenticated; select public.arb_set_bankroll(300);`,
);
assert.equal(
  (await db.query("select * from public.user_arb_legs")).rows.length,
  0,
);
assert.equal(
  (await db.query("select * from public.user_arb_bankroll")).rows.length,
  1,
);
await assert.rejects(
  call(ids[0], "edit", "A", 2, 150, "win", 300),
  /leg_not_owned/,
);
await assert.rejects(
  db.query("select public.arb_set_attempt_deleted($1,true)", [attempt]),
  /attempt_not_owned/,
);
await assert.rejects(
  db.exec("update public.user_arb_bankroll set opening_amount=999"),
  /permission denied/,
);
await db.exec("reset role; set role anon");
await assert.rejects(
  db.query("select public.arb_set_bankroll(300)"),
  /permission denied/,
);
console.log(
  "Shared bankroll SQL: placement, duplicate prevention, insufficient funds, settlement, correction, delete/restore, RLS and owner isolation passed.",
);
await db.close();
